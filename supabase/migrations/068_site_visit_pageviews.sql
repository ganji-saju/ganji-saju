-- 068_site_visit_pageviews.sql
-- 날짜: 2026-07-10
-- 목적: 자체 방문 집계를 GA/Vercel과 더 비교 가능하게 보정.
--   - 방문자: 기존처럼 KST date_key + visitor_hash 1행 = 일별 순방문.
--   - 페이지뷰: /api/visit page_view 호출마다 page_views 를 원자적으로 +1.
--   - first-touch path/referrer/UTM 은 비어 있을 때만 채운다.

create or replace function public.track_site_visit_pageview(
  p_date_key text,
  p_visitor_hash text,
  p_user_id uuid default null,
  p_first_path text default null,
  p_referrer_host text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
)
returns void
language plpgsql
volatile
as $$
begin
  insert into public.site_visits (
    date_key,
    visitor_hash,
    user_id,
    first_path,
    referrer_host,
    page_views,
    utm_source,
    utm_medium,
    utm_campaign
  )
  values (
    p_date_key,
    p_visitor_hash,
    p_user_id,
    left(nullif(p_first_path, ''), 200),
    left(nullif(p_referrer_host, ''), 120),
    1,
    left(nullif(p_utm_source, ''), 120),
    left(nullif(p_utm_medium, ''), 120),
    left(nullif(p_utm_campaign, ''), 120)
  )
  on conflict (date_key, visitor_hash)
  do update set
    page_views = public.site_visits.page_views + 1,
    user_id = coalesce(public.site_visits.user_id, excluded.user_id),
    first_path = coalesce(public.site_visits.first_path, excluded.first_path),
    referrer_host = coalesce(public.site_visits.referrer_host, excluded.referrer_host),
    utm_source = coalesce(public.site_visits.utm_source, excluded.utm_source),
    utm_medium = coalesce(public.site_visits.utm_medium, excluded.utm_medium),
    utm_campaign = coalesce(public.site_visits.utm_campaign, excluded.utm_campaign);
end;
$$;
