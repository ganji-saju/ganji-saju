-- 067_product_prices.sql
-- 날짜: 2026-07-07
-- 목적: 관리자 전상품 가격 제어(Phase 1). 카탈로그(PAYMENT_PACKAGES) 기본가를
--   런타임에 오버라이드 — price-resolver 가 이 테이블 우선, 없으면 카탈로그 폴백.
--   설계: docs/superpowers/specs/2026-07-07-admin-price-control-design.md
-- ⚠️ 프로덕션 적용: 062~066 과 동일하게 수동(supabase db push). 시드 없음 —
--    편집 전 상품은 리졸버가 catalog.ts 기본가로 폴백(단일 진실 = 카탈로그).

-- 1) 런타임 가격 오버라이드. KRW. RLS deny-all(service 전용).
create table if not exists public.product_prices (
  package_id      text primary key,
  price           integer not null check (price > 0),
  previous_price  integer check (previous_price is null or previous_price > 0),
  updated_at      timestamptz not null default now(),
  updated_by      text
);

comment on table public.product_prices is
  '상품 런타임 가격 오버라이드(카탈로그 PAYMENT_PACKAGES 기본가 위). price-resolver 조회 — /admin/pricing 편집.';

alter table public.product_prices enable row level security;
-- 정책 없음(deny-all) — 읽기/쓰기 모두 service role 경유.

-- 2) append-only 가격 변경 감사 이력.
create table if not exists public.product_price_changes (
  id              uuid primary key default gen_random_uuid(),
  package_id      text not null,
  old_price       integer,
  new_price       integer not null,
  previous_price  integer,
  changed_by      text,
  changed_at      timestamptz not null default now()
);

comment on table public.product_price_changes is
  '가격 변경 append-only 감사 이력(누가·언제·old→new). /admin/pricing POST 가 매 변경 기록.';

create index if not exists idx_product_price_changes_pkg_time
  on public.product_price_changes (package_id, changed_at desc);

alter table public.product_price_changes enable row level security;
-- 정책 없음(deny-all).
