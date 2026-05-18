-- 2026-05-18 Phase 3-B: 정책 버저닝 + 사용자 동의 이력.
--
-- 설계: docs/policies/policy-versioning.md
-- 9 정책 종류: terms / privacy / refund / digital-content / subscription / coin /
--             appointment / ai-disclaimer / commerce-disclosure
--
-- 운영자는 /admin/policies 에서 신규 버전 생성 (textarea + version + effective_date).
-- 사용자는 /terms /privacy 등 9 페이지에서 SSR fetch 로 본문 노출.
-- 사용자 동의는 회원가입/결제 시점에 user_policy_consents 에 insert.

-- 정책 버전 ────────────────────────────────────────────────────────────────────
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'terms',
    'privacy',
    'refund',
    'digital-content',
    'subscription',
    'coin',
    'appointment',
    'ai-disclaimer',
    'commerce-disclosure'
  )),
  version text not null,                                          -- 'v1.0.0' semver
  effective_date date not null,                                   -- 시행일 (한국시간 기준 날짜)
  content text not null,                                          -- 본문 (markdown/html/plaintext)
  content_format text not null default 'markdown' check (
    content_format in ('markdown', 'html', 'plaintext')
  ),
  content_hash text not null,                                     -- SHA-256 본문 무결성
  requires_reconsent boolean not null default false,              -- MAJOR 증가 시 true (재동의 의무)
  changelog text,                                                 -- 변경 사유 (운영자 입력)
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,   -- 작성 운영자
  unique (kind, version)
);

create index policy_versions_kind_effective_idx
  on public.policy_versions(kind, effective_date desc);

comment on table public.policy_versions is
  'Phase 3-B: 9 정책의 버전별 본문 + 시행일. 페이지 SSR fetch 의 source of truth.';

-- 사용자 동의 이력 ─────────────────────────────────────────────────────────────
create table public.user_policy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions(id),
  consented_at timestamptz not null default now(),
  consent_method text not null check (consent_method in (
    'signup_implicit',    -- 회원가입 시 implicit (한 줄 안내)
    'signup_explicit',    -- 회원가입 시 명시 체크박스
    'reconsent_modal',    -- 정책 변경 후 재동의 모달
    'payment_explicit',   -- 결제 전 명시 체크박스
    'admin_proxy'         -- 운영자 대리 입력 (드물게)
  )),
  product_id text,                                  -- 결제 시점 동의면 상품 ID
  order_id text,                                    -- 결제 시점 동의면 주문 ID
  user_agent text,                                  -- 브라우저 UA
  ip_hash text,                                     -- IP 원문 X — 해시만 (개인정보 과수집 방지)
  unique (user_id, policy_version_id)               -- 같은 user 가 같은 version 에 중복 동의 불가
);

create index user_policy_consents_user_idx on public.user_policy_consents(user_id);
create index user_policy_consents_version_idx on public.user_policy_consents(policy_version_id);

comment on table public.user_policy_consents is
  'Phase 3-B: 사용자별 정책 동의 이력. ip_hash 만 저장 (원문 IP 미수집).';

-- RLS ─────────────────────────────────────────────────────────────────────────
alter table public.policy_versions enable row level security;
alter table public.user_policy_consents enable row level security;

-- policy_versions: 모든 사용자 SELECT (정책은 공개 정보)
create policy "policy_versions_select_public" on public.policy_versions
  for select using (true);

-- policy_versions: INSERT / UPDATE / DELETE = service_role 만 (admin API 경로)
-- (admin API 가 createServiceClient 로 우회 — 일반 사용자 차단)

-- user_policy_consents: SELECT own
create policy "user_policy_consents_select_own" on public.user_policy_consents
  for select using (auth.uid() = user_id);

-- user_policy_consents: INSERT own (회원가입/결제 동의 시 자신 user_id 만)
create policy "user_policy_consents_insert_own" on public.user_policy_consents
  for insert with check (auth.uid() = user_id);

-- UPDATE / DELETE 차단 (동의 이력은 immutable)
