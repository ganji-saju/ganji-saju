-- 080_discount_coupon_one_live_per_user.sql — 요구 6 을 "평생 1개" 에서 **"동시에 1개"** 로.
--
-- 설계: docs/discount-coupon-design.md §1·§4
-- ⚠️ 프로덕션 적용은 수동(Supabase 대시보드 SQL Editor). 079 와 같은 관례.
--   🔴 앱 코드(released_at 조회·기록)보다 **먼저** 적용한다. 순서가 뒤집히면 쿠폰 조회가 전부 실패해
--      할인 없이 정가로만 보인다(실패-닫힘이라 돈은 틀리지 않지만 쿠폰이 꺼진다).
--
-- 사용자 결정(2026-09-11): 요구 6 = 동시에 1개.
--   079 의 인덱스는 `where bound_user_id is not null` 이라 **만료·회수된 쿠폰도 자리를 계속 차지**했다.
--   그러면 설계의 실무 대응 "소진된 배치를 끄고 재발행"에서, 끈 배치의 정상 고객이 재발행 코드를
--   영구히 못 쓴다(적대적 리뷰에서 리뷰어 2명이 독립적으로 지목).
--
-- 방식: 죽은 쿠폰(만료·회수·등급 회수)을 가진 계정이 새 코드를 귀속할 때, 앱이 옛 행에 released_at 을
--   찍어 자리에서 뺀다. 행은 지우지 않는다 — bound_user_id 는 감사·분쟁 증거로 남는다.
--   released_at 은 **종료 상태**다: 관리자가 나중에 배치를 되살려도 이미 새 쿠폰으로 옮긴 계정의
--   옛 쿠폰은 되살아나지 않는다(되살아나면 한 계정에 살아 있는 쿠폰이 둘이 된다).
--   bound_user_id 를 null 로 비우는 방식은 쓰지 않는다 — 관리자가 되살리는 순간 이미 쓴 전단 코드를
--   남이 다시 귀속할 수 있게 된다(요구 4 위반).

alter table public.discount_coupons add column if not exists released_at timestamptz;

comment on column public.discount_coupons.released_at is
  '귀속자가 새 쿠폰으로 옮기며 이 (죽은) 쿠폰을 자리에서 뺀 시각. 종료 상태 — 이후 누구도 이 코드를 쓸 수 없다.';

-- "살아 있는 귀속"만 한 자리. 동시요청 2건(두 탭에서 서로 다른 코드)도 여기서 한 건만 산다.
-- 새 인덱스를 **먼저** 만들고 옛 것을 지운다 — 중간에 제약이 비는 순간이 없게.
-- (새 조건이 옛 조건보다 느슨하므로 기존 데이터로 생성이 실패할 수 없다)
create unique index if not exists discount_coupons_one_live_per_user
  on public.discount_coupons(bound_user_id)
  where bound_user_id is not null and released_at is null;
drop index if exists public.discount_coupons_one_per_user;

-- PostgREST 스키마 캐시 갱신. 안 하면 적용 직후 released_at 조회가 'schema cache' 오류로 실패할 수 있다
-- (2026-05-24·07-04 phantom drift 때 쓴 복구 관례).
notify pgrst, 'reload schema';
