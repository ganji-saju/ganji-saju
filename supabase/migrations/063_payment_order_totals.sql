-- 063_payment_order_totals.sql
-- 날짜: 2026-07-04
-- 목적: 운영지표(누적 결제 건수/금액)를 행 전송 없이 SQL 집계 — admin 지표 감사(#599)
--       보류분. 기존엔 payment_orders 완료 행 전체를 페이지네이션으로 끌어와 JS 합산해
--       (1) 5만 행(MAX_PAGES) 초과 시 절단, (2) 대시보드 로드마다 전체 원장 왕복이었다.
--
-- 호출: service role 전용(운영지표 route 가 admin 가드 후 service 로 호출).
--       062 site_visit_daily_counts 와 동일하게 security invoker + RLS 는 호출자 권한.
--
-- ⚠️ 프로덕션 적용: 057~062 와 동일하게 수동 적용(supabase db push).
--    미적용 상태에서도 앱은 기존 행 페이지네이션 폴백으로 동작(operations-stats.ts).

-- 완료 상태 결제의 누적 건수/금액(원). 상태 목록은 operations-stats.ts
-- COMPLETED_ORDER_STATUSES 와 일치해야 한다.
create or replace function public.payment_order_totals()
returns table (order_count bigint, total_amount bigint)
language sql
stable
as $$
  select
    count(*)::bigint as order_count,
    coalesce(sum(o.amount), 0)::bigint as total_amount
  from public.payment_orders o
  where o.status in ('confirmed', 'fulfilling', 'fulfilled');
$$;
