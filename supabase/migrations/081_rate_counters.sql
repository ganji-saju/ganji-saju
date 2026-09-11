-- 081_rate_counters.sql — 계정과 무관하게 세는 원자 카운터. 첫 사용처: 쿠폰 코드 조회 예산(S2).
--
-- 제안서: docs/coupon-lookup-cap-proposal.md (사용자 채택 2026-09-11 — S2 등급별 예산)
-- ⚠️ 프로덕션 적용은 수동(Supabase 대시보드 SQL Editor). 079·080 과 같은 관례.
--   🔴 앱 코드보다 **먼저** 적용한다. 순서가 뒤집히면 RPC 가 없어 새 쿠폰 코드 조회가 전부 거부된다
--      (실패-닫힘이라 돈은 틀리지 않고, 결제·이미 등록된 쿠폰은 영향 없다).
--
-- 왜 056(membership_benefit_usage)을 안 쓰나: user_id 가 auth.users FK(on delete cascade)라
--   "모든 계정 합산" 버킷을 담을 수 없고, 계정을 지우면 카운터가 같이 사라진다.
--
-- 🔴 조회 **전에** 차감한다(적중 포함). "읽고 → 조회 → 빗나가면 차감"은 동시 폭주로 상한을 넘기고,
--   이미 아는 코드를 태우는 공격을 전혀 묶지 못한다.

create table if not exists public.rate_counters (
  bucket     text        not null,   -- 예: coupon:production:pool:open / coupon:production:acct:<uuid>
  period_key text        not null,   -- KST 날짜 'YYYY-MM-DD'
  used_count integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket, period_key)
);

-- RLS on + 정책 없음 = service role 전용(079 와 같은 원칙).
alter table public.rate_counters enable row level security;

-- 한도 안이면 +1 한 새 값을, 한도에 닿아 있으면 NULL 을 돌려준다(원자적).
--   ON CONFLICT DO UPDATE 는 충돌 행을 잠그고 최신 값으로 WHERE 를 다시 평가하므로 동시 요청도 한도를 넘지 않는다.
--   p_limit <= 0 이면 항상 NULL(= 닫힘).
create or replace function public.consume_rate_counter(p_bucket text, p_period_key text, p_limit int)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.rate_counters as c (bucket, period_key, used_count)
  select p_bucket, p_period_key, 1
  where p_limit > 0
  on conflict (bucket, period_key) do update
    set used_count = c.used_count + 1, updated_at = now()
    where c.used_count < p_limit
  returning used_count;
$$;

revoke execute on function public.consume_rate_counter(text, text, int) from public, anon, authenticated;

comment on table public.rate_counters is
  '계정과 무관한 원자 카운터(쿠폰 조회 예산 등). 가명 식별자(user uuid, 소셜 신원 해시)가 쌓인다 — 30일 지난 행은 운영 SQL 로 지운다.';

-- ponytail: 오래된 행 정리는 운영 SQL 수동(delete where period_key < 30일 전). 행이 커지면 크론으로 옮긴다.

notify pgrst, 'reload schema';
