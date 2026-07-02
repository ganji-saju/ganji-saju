-- 059_kakao_messaging.sql
-- 날짜: 2026-07-02
-- 목적: 카카오 비즈니스 메시지(알림톡/친구톡) 기반 — 전화번호 수집(Phase B1) +
--       발송 로그(Phase B2) 스키마.
--
-- 표:
--   user_contact       — 사용자 전화번호 + 광고 수신동의(친구톡·광고 알림톡용).
--   kakao_message_log  — 발송 큐/이력(멱등키·발송상태·대행사 메시지ID).
--
-- ⚠️ 프로덕션 적용: 057/058과 동일하게 배포 체크리스트에 따라 수동 적용
--    (`supabase db push`). 이 파일만 커밋; 원격 DB 자동 적용 안 함.

create extension if not exists pgcrypto;

-- ── 사용자 연락처 + 광고 수신동의 ───────────────────────────────────────────────
create table if not exists public.user_contact (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text,                                                    -- 국내 하이픈 제거(예: 01012345678). Solapi 발송 포맷.
  phone_country text not null default 'KR',
  ad_consent boolean not null default false,                     -- 광고성 정보 수신동의(친구톡/광고 알림톡)
  ad_consent_at timestamptz,                                     -- 동의 시각(정보통신망법 이력 보관)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_contact is
  '카카오 알림톡 대상 전화번호 + 광고 수신동의(친구톡). 정보성 알림톡은 phone 만 필요, 광고성은 ad_consent 필요.';

alter table public.user_contact enable row level security;

-- 본인 행만 조회/삽입/수정 (service_role 은 RLS 우회).
drop policy if exists user_contact_select_own on public.user_contact;
create policy user_contact_select_own on public.user_contact
  for select using (auth.uid() = user_id);

drop policy if exists user_contact_insert_own on public.user_contact;
create policy user_contact_insert_own on public.user_contact
  for insert with check (auth.uid() = user_id);

drop policy if exists user_contact_update_own on public.user_contact;
create policy user_contact_update_own on public.user_contact
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 카카오 발송 로그(큐/이력) ────────────────────────────────────────────────────
create table if not exists public.kakao_message_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  to_phone text,                                                -- 발송 대상(스냅샷)
  kind text not null check (kind in ('alimtalk', 'friendtalk')),
  template_code text,                                           -- 알림톡 승인 템플릿 코드(친구톡은 null 가능)
  variables jsonb not null default '{}'::jsonb,                 -- 템플릿 치환 변수
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'substituted')),  -- substituted = 알림톡 실패 시 SMS 대체발송
  vendor text not null default 'solapi',
  vendor_msg_id text,                                           -- 대행사 메시지 ID(webhook 매칭)
  error text,
  idempotency_key text unique,                                 -- 중복 발송 차단
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.kakao_message_log is
  'Phase B2: 카카오 발송 큐/이력. idempotency_key 로 중복 발송 차단, vendor_msg_id 로 webhook 상태 매칭.';

create index if not exists kakao_message_log_user_idx
  on public.kakao_message_log(user_id, created_at desc);
create index if not exists kakao_message_log_status_idx
  on public.kakao_message_log(status, created_at desc);
create index if not exists kakao_message_log_vendor_msg_idx
  on public.kakao_message_log(vendor_msg_id);

-- 로그는 서버(service_role)만 접근. RLS 활성 + 정책 없음 → 사용자 직접 접근 차단(관리자 조회는 service_role).
alter table public.kakao_message_log enable row level security;

-- updated_at 자동 갱신 트리거(user_contact).
create or replace function public.touch_user_contact_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_contact_updated_at on public.user_contact;
create trigger trg_user_contact_updated_at
  before update on public.user_contact
  for each row execute function public.touch_user_contact_updated_at();
