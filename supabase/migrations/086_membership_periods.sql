-- 086_membership_periods.sql — 멤버십 결제별 기간 원장(설계: docs/membership-period-ledger-design.md).
--
-- ⚠️ 프로덕션 적용은 수동(Supabase 대시보드 SQL Editor). **앱 머지 전에** 적용한다 — 앱이 이 표를 읽고 쓴다
--    (없으면 멤버십 지급·관리자 부여·해제·환불이 전부 실패한다).
--
-- 왜: 구독은 사용자당 1행(subscriptions.renews_at)에 결제(30일)·관리자 부여가 끝에 누적돼 결제별 실제 기간이 없었다.
--    환불 잠금(되돌릴 수 없는 삭제)을 추정 기간으로 해 연속 결제·관리자 부여·해제·재구매가 섞이면 남의 기간을 지우거나(과다)
--    못 잠갔다(과소). 이제 기간을 행으로 기록하고 모든 변경(지급·부여·해제·환불)이 이 표를 갱신한다.
-- 불변식: 살아 있는(voided_at null) 기간은 겹치지 않는 사슬이고 subscriptions.renews_at = 살아 있는 max(end_at).
--
-- 적용 전 확인:
--   select to_regclass('public.membership_periods');            -- null 이어야 한다(이미 있으면 백필이 중복되지 않는지 아래 not exists 가 막는다)
--   select count(*) from public.subscriptions
--    where status in ('active','cancelled') and renews_at > now(); -- 백필될 legacy 행 수(적용 후 비교)
--
-- 적용 후 확인:
--   select source, count(*) from public.membership_periods group by 1;   -- legacy = 위 수
--   select count(*) from public.subscriptions s
--    where s.status in ('active','cancelled') and s.renews_at > now()
--      and not exists (select 1 from public.membership_periods p
--                       where p.user_id = s.user_id and p.voided_at is null and p.end_at = s.renews_at); -- 0
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'membership_periods'
--      and grantee in ('anon','authenticated','public');                 -- 0행
--   select relrowsecurity from pg_class where oid = 'public.membership_periods'::regclass; -- true

create table if not exists public.membership_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source text not null check (source in ('payment', 'admin_grant', 'legacy')),
  order_id text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  constraint membership_periods_end_after_start check (end_at > start_at),
  constraint membership_periods_payment_has_order check (source <> 'payment' or order_id is not null)
);

create index if not exists membership_periods_user_end_idx on public.membership_periods (user_id, end_at);

-- 같은 결제의 살아 있는 기간은 1개 — 지급 재시도는 새 행을 만들지 않고 기존 행을 쓴다(앱이 먼저 조회, 여기는 마지막 방어).
create unique index if not exists membership_periods_live_payment_uidx
  on public.membership_periods (order_id)
  where source = 'payment' and voided_at is null;

-- service_role 전용. RLS on·정책 없음 + 테이블 권한 회수(083·085 교훈 — Supabase 는 새 테이블에 anon·authenticated 권한을 기본 부여한다).
alter table public.membership_periods enable row level security;
revoke all on table public.membership_periods from public, anon, authenticated;

-- 백필: 지금 권한이 남은 구독마다 legacy 1행 [now(), renews_at) — 잠금 대상이 아니라 사슬의 끝을 renews_at 에 맞추는 용도.
--   (다음 결제가 이 끝에 이어 붙고, 앞 결제 환불의 당기기·관리자 해제가 이 행도 같이 옮기거나 자른다.)
insert into public.membership_periods (user_id, source, start_at, end_at)
select s.user_id, 'legacy', now(), s.renews_at
from public.subscriptions s
where s.status in ('active', 'cancelled')
  and s.renews_at > now()
  and not exists (select 1 from public.membership_periods p where p.user_id = s.user_id);

notify pgrst, 'reload schema';
