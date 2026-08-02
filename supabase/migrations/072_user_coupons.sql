-- 072_user_coupons.sql — 카카오 친구추가 무료쿠폰(오늘 자세히보기 1회). 계정당 1회.
create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  status text not null default 'issued' check (status in ('issued','redeemed')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redemption_reading_key text,
  entitlement_id uuid,
  verified_kakao_uid text,
  constraint user_coupons_unique_per_type unique (user_id, type)
);
create index if not exists user_coupons_user_idx on public.user_coupons(user_id);
alter table public.user_coupons enable row level security;
-- 본인 조회만. 발급/사용은 service role(RLS 우회)로만.
drop policy if exists user_coupons_select_own on public.user_coupons;
create policy user_coupons_select_own on public.user_coupons
  for select using (auth.uid() = user_id);
