-- 066_metrics_daily.sql
-- 날짜: 2026-07-07
-- 목적: /admin/analytics — 방문자·전환·유입·결제를 매일 롤업해 누적 시계열 그래프로.
--   설계: docs/superpowers/specs/2026-07-07-admin-analytics-daily-design.md
--   - metrics_daily: KST 하루 1행. 크론(/api/admin/metrics/rollup)이 raw 에서 멱등 upsert.
--   - site_visits 에 UTM 3종 추가(배포 후부터 수집; VisitPing → /api/visit).
--   - metrics_daily_source RPC: site_visits 를 서버 group-by(행 전송 없이) — 일별 방문자/PV
--     + 상위 유입(referrer host / utm) jsonb. site_visits RLS deny-all → service 로 호출.
--
-- ⚠️ 프로덕션 적용: 062~065 와 동일하게 수동 적용(supabase db push).
--    선결: 062(site_visits)/065 가 prod 에 적용돼 있어야 방문자 데이터 존재.

-- 1) site_visits 에 UTM 수집 컬럼(배포 후부터 채워짐; 기존 행은 null).
alter table public.site_visits add column if not exists utm_source text;
alter table public.site_visits add column if not exists utm_medium text;
alter table public.site_visits add column if not exists utm_campaign text;

-- 2) 일별 롤업 테이블 — KST 하루 1행. RLS enable + 정책 0개(service 전용).
create table if not exists public.metrics_daily (
  date_key text primary key,                 -- KST YYYY-MM-DD
  visitors integer not null default 0,        -- distinct visitor_hash
  page_views integer not null default 0,
  new_signups integer not null default 0,
  paid_orders integer not null default 0,     -- 완료 결제 건수
  revenue_won bigint not null default 0,      -- 완료 결제 합(원)
  prepare_attempts integer not null default 0,
  checkout_starts integer not null default 0, -- funnel confirm_attempt
  confirm_success integer not null default 0,
  inflow_referrers jsonb not null default '[]'::jsonb, -- [{host, visitors}] 상위 N
  inflow_utm jsonb not null default '[]'::jsonb,        -- [{source, medium, campaign, visitors}] 상위 N
  refreshed_at timestamptz not null default now()
);

comment on table public.metrics_daily is
  '자체 일별 지표 롤업(방문자·전환·유입·결제). 크론이 raw 에서 멱등 upsert — /admin/analytics 그래프 source.';

alter table public.metrics_daily enable row level security;
-- 정책 없음(deny-all) — 쓰기/읽기 모두 service role 경유.

-- 3) 일별 방문자/PV + 상위 유입(referrer host / utm) 집계 — 행 전송 없이 서버 집계.
--    site_visit_daily_counts(062)의 확장판(유입 breakdown 포함). 상위 10개로 캡.
create or replace function public.metrics_daily_source(from_key text, to_key text)
returns table (
  date_key text,
  visitors bigint,
  page_views bigint,
  inflow_referrers jsonb,
  inflow_utm jsonb
)
language sql
stable
as $$
  with base as (
    select
      v.date_key,
      v.visitor_hash,
      coalesce(v.page_views, 1) as page_views,
      coalesce(nullif(v.referrer_host, ''), '(direct)') as ref_host,
      v.utm_source, v.utm_medium, v.utm_campaign
    from public.site_visits v
    where v.date_key >= from_key and v.date_key <= to_key
  ),
  day_counts as (
    select date_key,
           count(*)::bigint as visitors,
           sum(page_views)::bigint as page_views
    from base
    group by date_key
  ),
  ref as (
    select date_key, ref_host as host, count(*)::bigint as visitors,
           row_number() over (partition by date_key order by count(*) desc, ref_host) as rn
    from base
    group by date_key, ref_host
  ),
  ref_top as (
    select date_key,
           jsonb_agg(jsonb_build_object('host', host, 'visitors', visitors) order by visitors desc) as inflow_referrers
    from ref
    where rn <= 10
    group by date_key
  ),
  utm as (
    select date_key,
           utm_source as source,
           coalesce(utm_medium, '') as medium,
           coalesce(utm_campaign, '') as campaign,
           count(*)::bigint as visitors,
           row_number() over (partition by date_key order by count(*) desc, utm_source) as rn
    from base
    where utm_source is not null and utm_source <> ''
    group by date_key, utm_source, coalesce(utm_medium, ''), coalesce(utm_campaign, '')
  ),
  utm_top as (
    select date_key,
           jsonb_agg(jsonb_build_object(
             'source', source, 'medium', medium, 'campaign', campaign, 'visitors', visitors
           ) order by visitors desc) as inflow_utm
    from utm
    where rn <= 10
    group by date_key
  )
  select
    d.date_key,
    d.visitors,
    d.page_views,
    coalesce(r.inflow_referrers, '[]'::jsonb),
    coalesce(u.inflow_utm, '[]'::jsonb)
  from day_counts d
  left join ref_top r using (date_key)
  left join utm_top u using (date_key)
  order by d.date_key asc;
$$;
