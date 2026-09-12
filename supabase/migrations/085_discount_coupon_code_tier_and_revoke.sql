-- 085_discount_coupon_code_tier_and_revoke.sql — 할인쿠폰 PR6(관리자 발급 화면)의 DB 방어 두 겹.
--
-- ⚠️ 프로덕션 적용은 수동(Supabase 대시보드 SQL Editor). 079·080 과 같은 관례. **앱 머지 전에** 적용한다.
--    앱은 085 없이도 동작한다(방어 겹이라 순서 의존은 없다) — 다만 발급 화면이 켜지기 전에 제약이 서 있어야 한다.
--
-- 1) 코드 접두 = 등급(tier). 실제 요율은 tier 컬럼 조인에서만 나오고 접두는 보지 않는다 — 발급 버그 하나로
--    'ganji10xxxx' 에 50% 가 걸려도 인쇄물은 되돌릴 수 없다. 앱(issueCouponBatch)이 한 곳에서 접두를 만들지만 DB 가 한 번 더 막는다.
--    적용 전 확인(0 이어야 한다):
--      select count(*) from public.discount_coupons where substring(code from 6 for 2) <> tier;
--    0 이 아니면 행을 지우지 말고(079 — 감사 보존) 아래 add constraint 끝에 `not valid` 를 붙여 신규 행만 강제한다.
alter table public.discount_coupons drop constraint if exists discount_coupons_code_matches_tier;
alter table public.discount_coupons
  add constraint discount_coupons_code_matches_tier check (substring(code from 6 for 2) = tier);

-- 2) RLS on·정책 없음(079)에 더해 테이블 권한 자체를 회수한다. Supabase 는 새 테이블에 anon·authenticated 권한을 기본 부여한다 —
--    누가 072 식 "본인 select" 정책을 복사하는 순간 미사용 코드 목록(= 현금 목록)·쿠폰 감사 기록이 anon 키로 샌다.
--    전부 service_role 로만 읽고 쓴다(2026-09-13 전수 확인: coupon-charge · coupon-order-guard · coupon-admin · access-log ·
--    dashboard-summary). consume_rate_counter 는 SECURITY DEFINER 라 이 회수와 무관하다(081 에서 EXECUTE 도 회수했다).
--    ⚠️ 새 쿠폰 테이블을 만들면 같은 마이그레이션에서 이렇게 회수할 것.
revoke all on table
  public.discount_coupons,
  public.coupon_tiers,
  public.coupon_tier_changes,
  public.rate_counters,
  public.admin_access_log
from public, anon, authenticated;

-- PostgREST 스키마 캐시 갱신(080 과 같은 관례).
notify pgrst, 'reload schema';
