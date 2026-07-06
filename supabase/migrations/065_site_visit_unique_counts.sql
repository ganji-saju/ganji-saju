-- 065_site_visit_unique_counts.sql
-- 날짜: 2026-07-06
-- 목적: admin 지표 — 기간별 "순방문자"(distinct visitor_hash). site_visits(062)는
--       (date_key, visitor_hash) 로 방문자를 '하루 단위'로만 dedupe 하므로,
--       site_visit_daily_counts(일별 집계)를 그냥 합하면 재방문자가 여러 번 셈된다.
--       이 함수는 주간/월간/누적(전체) 각 기간의 '서로 다른 방문자 수'를 한 번의
--       집계로 반환한다(오늘 ≤ 주간 ≤ 월간 ≤ 누적으로 자연스럽게 중첩).
--
-- 설계: site_visit_daily_counts(062)와 동일 — 행 전송 없이 서버 집계, service 경유
--       (site_visits 는 RLS deny-all, admin 은 service 클라이언트로 호출해 우회).
--
-- ⚠️ 프로덕션 적용: 062~064 와 동일하게 수동 적용(supabase db push).
--    미적용 시 호출부(operations-stats)가 error → weekly/monthly/allTime = null 로
--    graceful 처리('—' 표시). 오늘 방문자(daily_counts, 062)는 영향 없음.

create or replace function public.site_visit_unique_counts(week_key text, month_key text)
returns table (weekly bigint, monthly bigint, all_time bigint)
language sql
stable
as $$
  select
    count(distinct visitor_hash) filter (where date_key >= week_key)::bigint as weekly,
    count(distinct visitor_hash) filter (where date_key >= month_key)::bigint as monthly,
    count(distinct visitor_hash)::bigint as all_time
  from public.site_visits;
$$;
