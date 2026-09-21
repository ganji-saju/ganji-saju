-- 외부 주문 PDF 생성 이력. 검토 후 이 파일만 적용하고 앱을 배포한다.
-- 과거 브라우저에서만 생성한 결과는 백필하지 않는다.
begin;

create table public.admin_external_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  report_no text not null unique,
  subject_name text not null check (char_length(subject_name) between 1 and 40),
  birth_input jsonb not null check (jsonb_typeof(birth_input) = 'object'),
  generation_source text not null check (generation_source in ('openai', 'fallback')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);

create index admin_external_reports_created_idx on public.admin_external_reports (created_at desc, id desc);
alter table public.admin_external_reports enable row level security;
-- 공개/일반 로그인 세션에는 정책과 권한을 주지 않는다. 서버의 최고 관리자 가드 뒤에서만 접근.
revoke all on public.admin_external_reports from public, anon, authenticated, service_role;
grant select, insert on public.admin_external_reports to service_role;

comment on table public.admin_external_reports is '최고 관리자 외부 주문 PDF: 검증된 출생 정보와 생성 당시 풀이 snapshot. AI 재생성 없이 재출력.';

commit;
