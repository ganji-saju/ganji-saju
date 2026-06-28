-- 2026-06-28 — 프리미엄 멤버십 혜택 쿼터 추적.
--   매일 대화 5건 무료(dialogue_daily, 일 단위) · 궁합 월 3회 무료(compat_monthly, 월 단위) 등
--   기간별 사용량을 원자적으로 카운트. 서버 게이트(service_role)만 호출.
create table if not exists public.membership_benefit_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  benefit    text not null,
  period_key text not null,          -- 'YYYY-MM-DD'(일) 또는 'YYYY-MM'(월), KST 기준
  used_count int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, benefit, period_key)
);

alter table public.membership_benefit_usage enable row level security;
-- 정책 미정의 = anon/authenticated 전면 차단. service_role(서버)만 RPC 경유 접근.

-- 한도 내면 +1 후 true, 초과면 false. row 잠금으로 동시성 안전(원자적).
create or replace function public.consume_member_benefit(
  p_user_id uuid,
  p_benefit text,
  p_period_key text,
  p_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  insert into public.membership_benefit_usage (user_id, benefit, period_key, used_count)
  values (p_user_id, p_benefit, p_period_key, 0)
  on conflict (user_id, benefit, period_key) do nothing;

  select used_count into v_used
  from public.membership_benefit_usage
  where user_id = p_user_id and benefit = p_benefit and period_key = p_period_key
  for update;

  if v_used >= p_limit then
    return false;
  end if;

  update public.membership_benefit_usage
  set used_count = used_count + 1, updated_at = now()
  where user_id = p_user_id and benefit = p_benefit and period_key = p_period_key;

  return true;
end;
$$;

-- 소비 없이 현재 사용량만 조회(빌링 요약 표시용).
create or replace function public.get_member_benefit_used(
  p_user_id uuid,
  p_benefit text,
  p_period_key text
) returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select used_count from public.membership_benefit_usage
     where user_id = p_user_id and benefit = p_benefit and period_key = p_period_key),
    0
  );
$$;

revoke execute on function public.consume_member_benefit(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public.get_member_benefit_used(uuid, text, text) from public, anon, authenticated;
