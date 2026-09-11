-- 079_discount_coupons.sql — 오프라인(전단·명함) 배포 할인쿠폰.
--
-- 설계: docs/discount-coupon-design.md
-- ⚠️ 프로덕션 적용은 수동(Supabase 대시보드 SQL Editor). 067·072·075 와 같은 관례.
--
-- 사용자 결정(2026-09-11):
--   A. 일련번호 4자리 — 인쇄 형식 `ganji-10-0000`, 저장은 정규형 `ganji100000`
--   B. 로그인(구글·카카오·이메일) 계정이면 사용 가능. 소셜 전용으로 제한하지 않는다
--      🔴 남는 위험: signup/route.ts 가 email_confirm:true 로 이메일 인증을 건너뛰어
--         계정 생성 비용이 사실상 0 이다. "계정당 1개" 는 상한이 되지 못한다.
--         → 완화는 24시간 미결제 회수 + 시도 제한 + disabled_at 회수뿐이다.
--         전단이 빠르게 소진되면 disabled_at 로 배치를 끄고 재발행하는 것이 실무 대응.
--   D. 만료일 기본 2027-12-31(KST). 관리자가 변경한다.
--
-- 설계 3원칙:
--  1) 코드 접두 숫자는 **등급 라벨**이다. 실제 할인율 정본은 coupon_tiers 뿐이다.
--  2) auth.users FK 를 걸지 않는다 — 072 가 on delete cascade 로 낸 구멍(탈퇴하면 귀속이
--     사라져 코드가 부활)을 075·076 이 두 번 막았다. FK 를 거는 순간 세 번째다.
--  3) RLS on + 정책 없음 = service role 전용. 미사용 코드 목록은 곧 현금 목록이다.

-- ─────────────────────────────────────────────────────────────
-- 1) 등급별 할인율 = 요구 2(관리자 변경)의 유일 정본
-- ─────────────────────────────────────────────────────────────
create table if not exists public.coupon_tiers (
  tier             text primary key check (tier in ('10','20','30','40','50')),
  -- 🔴 0 을 허용하지 않는다. 0% 로 귀속되면 계정당 1개 제약 때문에 그 계정은 영구히
  --    다른 쿠폰을 못 쓴다. 등급을 끄려면 disabled_at 을 쓴다.
  percent          integer not null check (percent between 1 and 50),
  -- 주문당 할인 상한(원). null = 상한 없음. 손실이 터질 때 넣는 브레이크.
  max_discount_won integer check (max_discount_won is null or max_discount_won > 0),
  disabled_at      timestamptz,
  updated_at       timestamptz not null default now(),
  updated_by       text
);
-- 초기값 = 접두 숫자 그대로. 발주 시점 인쇄물과 100% 일치시킨다.
insert into public.coupon_tiers (tier, percent) values
  ('10',10),('20',20),('30',30),('40',40),('50',50)
on conflict (tier) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 2) 코드 원장 — 코드 자체가 원장이라 075 식 별도 ledger 가 필요 없다
-- ─────────────────────────────────────────────────────────────
create table if not exists public.discount_coupons (
  -- 정규형 소문자·구분자 없음. 인쇄는 ganji-10-0000, 저장은 ganji100000.
  code          text primary key check (code ~ '^ganji(10|20|30|40|50)[0-9]{4}$'),
  tier          text not null references public.coupon_tiers(tier),
  batch         text,                     -- 인쇄 배치('2026-09-강남전단') = ROI 조인 키 · 일괄 회수 키
  bound_user_id uuid,                     -- 🔴 auth.users FK 없음(원칙 2). null = 미귀속
  bound_at      timestamptz,
  -- 귀속 순간의 스냅샷. 관리자가 요율·상한을 내려도 이미 쓰던 고객은 안 깎인다.
  bound_percent          integer check (bound_percent is null or bound_percent between 1 and 50),
  bound_max_discount_won integer,
  bound_origin  text,                     -- production|staging (같은 DB 공유 → 오염 사후 복구용)
  -- D: 기본 만료 2027-12-31 24:00 KST = 2027-12-31T15:00Z. 관리자가 변경한다.
  expires_at    timestamptz not null default '2027-12-31T14:59:59+00:00',
  disabled_at   timestamptz,              -- 개별/배치 회수. 행을 삭제하지 않는다(감사 보존)
  created_at    timestamptz not null default now(),
  created_by    text
);

-- 요구 6(계정당 쿠폰 1개)을 앱 조건문이 아니라 **DB 가** 자른다. 동시요청 2건도 여기서 죽는다.
create unique index if not exists discount_coupons_one_per_user
  on public.discount_coupons(bound_user_id) where bound_user_id is not null;
create index if not exists discount_coupons_tier_idx  on public.discount_coupons(tier, bound_at);
create index if not exists discount_coupons_batch_idx on public.discount_coupons(batch);

-- ─────────────────────────────────────────────────────────────
-- 3) 할인율·상한 변경 감사(append-only). product_price_changes(067) 와 같은 모양.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.coupon_tier_changes (
  id                   uuid primary key default gen_random_uuid(),
  tier                 text not null,
  old_percent          integer,
  new_percent          integer not null,
  old_max_discount_won integer,
  new_max_discount_won integer,
  -- 이미 귀속된 쿠폰에도 소급했는지(요구 3 분쟁 대응 기록).
  applied_to_bound     boolean not null default false,
  changed_by           text,
  changed_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 4) 주문에 할인 스냅샷
--    🔴 amount(실청구액)의 의미는 바꾸지 않는다 — 승인 대조·환불·매출집계가 전부 이 값을 본다.
--       할인은 추가 컬럼으로만 표현한다.
-- ─────────────────────────────────────────────────────────────
alter table public.payment_orders add column if not exists list_amount    integer;
alter table public.payment_orders add column if not exists discount_won   integer not null default 0;
alter table public.payment_orders add column if not exists coupon_code    text;
alter table public.payment_orders add column if not exists coupon_percent integer;
create index if not exists payment_orders_coupon_idx
  on public.payment_orders(coupon_code) where coupon_code is not null;

-- ─────────────────────────────────────────────────────────────
-- RLS: 전부 켜고 정책은 두지 않는다 = service role 전용.
-- 🔴 072 식 "본인 select" 정책을 복사하지 말 것 — 아직 귀속되지 않은 행(=미사용 코드 전량)이
--    조건에 따라 새어 나갈 수 있다. 사용자에게 필요한 정보는 서버가 계산해 내려준다.
-- ─────────────────────────────────────────────────────────────
alter table public.coupon_tiers        enable row level security;
alter table public.discount_coupons    enable row level security;
alter table public.coupon_tier_changes enable row level security;

comment on table public.discount_coupons is
  '오프라인 배포 할인쿠폰. code = 무기명 증서이므로 RLS 정책 없음(미사용 코드 유출 = 현금 유출).';
