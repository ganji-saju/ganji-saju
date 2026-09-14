-- 086_membership_periods.sql — 멤버십 결제별 기간 원장(설계: docs/membership-period-ledger-design.md).
--
-- ⚠️ 프로덕션 적용은 수동(Supabase 대시보드 SQL Editor). 앱이 이 표를 읽고 쓴다(없으면 멤버십 지급·관리자 부여·해제·환불이 전부 실패).
--
-- 배포 절차(적용~배포 사이엔 옛 코드가 돌며 표를 모른 채 구독만 바꾼다 — 그 틈을 짧게, 끝에서 확인):
--   ① 아래 "적용 전 확인" → ② 이 파일 적용 → "적용 후 확인"(드리프트 0) → ③ 곧바로 PR 머지·배포
--   → ④ Vercel 배포 완료 직후 드리프트 쿼리 재실행. **0 이 아니면 멈추고 보고**(구독과 표가 어긋난 사용자 — 수동 정리).
--   ②~④ 사이 관리자 멤버십 부여/해제·멤버십 환불 금지(옛 코드가 구독만 바꿔 표와 어긋난다).
--   앱: 구독 끝이 표보다 뒤인 틈(옛 코드 지급)은 다음 지급이 legacy 행으로 메운다(상향 자가치유). 반대(구독 끝 < 표 끝 — 옛 코드 해제·환불)는
--   찢긴 지급과 구별이 안 돼 앱이 흡수하지 않는다 → 드리프트 쿼리가 유일한 방어선. 표에 없는 지급 주문의 환불은 last_error 'membership_period_missing'.
--
-- 왜: 구독은 사용자당 1행(subscriptions.renews_at)에 결제(30일)·관리자 부여가 끝에 누적돼 결제별 실제 기간이 없었다.
--    환불 잠금(되돌릴 수 없는 삭제)을 추정 기간으로 해 연속 결제·관리자 부여·해제·재구매가 섞이면 남의 기간을 지우거나(과다)
--    못 잠갔다(과소). 이제 기간을 행으로 기록하고 모든 변경(지급·부여·해제·환불)이 이 표를 갱신한다.
-- 불변식: 살아 있는(voided_at null) 기간은 겹치지 않는 사슬이고 subscriptions.renews_at = 살아 있는 max(end_at).
--   겹치지 않음은 DB 가 강제한다(배제 제약 — 결제 지급·관리자 부여가 동시에 돌아 두 행이 겹치는 경합도 한쪽이 23P01 로 실패).
--
-- 적용 전 확인:
--   select to_regclass('public.membership_periods');            -- null 이어야 한다(이미 있으면 백필이 중복되지 않는지 아래 not exists 가 막는다)
--   select count(*) from public.subscriptions
--    where status in ('active','cancelled') and renews_at > now(); -- 백필될 legacy 행 수(적용 후 비교)
--
-- 적용 후 확인:
--   select source, count(*) from public.membership_periods group by 1;   -- legacy = 위 수
--   -- 드리프트(④에서도 재실행) — 둘 다 0:
--   --   chain_vs_renews: 살아 있는 사슬 끝이 미래인데 구독 renews_at 과 다름(옛 코드 지급 = 구독이 뒤 · 옛 코드 해제/환불 = 구독이 앞)
--   --   entitled_without_end: 권한 남은 구독(active·cancelled, renews_at 미래)인데 renews_at 에서 끝나는 살아 있는 행 없음
--   select
--     (select count(*)
--        from (select user_id, max(end_at) as chain_end from public.membership_periods
--               where voided_at is null group by user_id) c
--        left join public.subscriptions s using (user_id)
--       where c.chain_end > now() and s.renews_at is distinct from c.chain_end) as chain_vs_renews,
--     (select count(*) from public.subscriptions s
--       where s.status in ('active','cancelled') and s.renews_at > now()
--         and not exists (select 1 from public.membership_periods p
--                          where p.user_id = s.user_id and p.voided_at is null and p.end_at = s.renews_at)) as entitled_without_end;
--   select conname from pg_constraint
--    where conrelid = 'public.membership_periods'::regclass and contype = 'x';  -- membership_periods_live_no_overlap
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'membership_periods'
--      and grantee in ('anon','authenticated','public');                 -- 0행
--   select relrowsecurity from pg_class where oid = 'public.membership_periods'::regclass; -- true

-- 배제 제약의 `user_id with =`(uuid 의 gist 연산자 클래스)용.
create extension if not exists btree_gist with schema extensions;

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
  constraint membership_periods_payment_has_order check (source <> 'payment' or order_id is not null),
  -- 같은 사용자의 살아 있는 기간 [start_at, end_at) 은 겹치지 않는다(맞닿음은 허용). 앱의 모든 update 순서가 이걸 지킨다(무효 먼저·당기기 오름차순).
  constraint membership_periods_live_no_overlap
    exclude using gist (user_id with =, tstzrange(start_at, end_at) with &&) where (voided_at is null)
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
