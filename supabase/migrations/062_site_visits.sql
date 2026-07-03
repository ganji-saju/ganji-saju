-- 062_site_visits.sql
-- 날짜: 2026-07-04
-- 목적: 자체 방문(유입) 카운트 — admin 지표 전수검증(#593)에서 확인된 "실방문 지표
--       부재"(trackMoonlightEvent 는 dataLayer 전용, DB 저장 없음) 보완.
--
-- 설계(docs/superpowers/specs/2026-07-04-site-visits-design.md):
--   - 클라이언트가 KST 일 1회 /api/visit 핑(localStorage 익명 vid, PII 없음).
--   - 서버가 vid 를 sha256 해시해 (date_key, visitor_hash) upsert — 일별 순방문자.
--   - 집계는 RPC(group-by)로 행 전송 없이 — PostgREST 1000행 캡 무관.
--   - RLS enable + 정책 0개(service 전용 — 쓰기/읽기 모두 서버 경유).
--
-- ⚠️ 프로덕션 적용: 057~059 와 동일하게 수동 적용(supabase db push).

create table if not exists public.site_visits (
  date_key text not null,                       -- KST YYYY-MM-DD
  visitor_hash text not null,                   -- sha256(익명 vid) — PII 아님
  user_id uuid references auth.users(id) on delete set null,  -- 로그인 시 참조(선택)
  first_path text,                              -- 그날 첫 진입 경로
  referrer_host text,                           -- 유입 referrer 호스트(있으면)
  page_views integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (date_key, visitor_hash)
);

comment on table public.site_visits is
  '자체 일별 순방문(유입) 집계 — 클라 1일 1핑 기반. 광고차단기/JS 미실행 방문은 미포함(하한치).';

create index if not exists site_visits_date_idx on public.site_visits(date_key);

alter table public.site_visits enable row level security;
-- 정책 없음(deny-all) — 쓰기/읽기 모두 service role 경유.

-- 일별 방문자/PV 집계 — 행 전송 없이 서버 집계(윈도우 60일 × N방문자 행 회피).
create or replace function public.site_visit_daily_counts(from_key text, to_key text)
returns table (date_key text, visitors bigint, page_views bigint)
language sql
stable
as $$
  select
    v.date_key,
    count(*)::bigint as visitors,
    coalesce(sum(v.page_views), 0)::bigint as page_views
  from public.site_visits v
  where v.date_key >= from_key and v.date_key <= to_key
  group by v.date_key
  order by v.date_key asc;
$$;
