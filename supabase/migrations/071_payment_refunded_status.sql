-- 071_payment_refunded_status.sql
-- 날짜: 2026-07-13
-- 목적: 결제 성공분의 환불을 'canceled'(결제 전 취소)와 구분한다.
--
-- 배경: 2026-07-10 서비스 첫 성공 결제(score-total 9,900원)를 PG 취소하자 주문이 canceled 로
--   덮여 매출 이력에서 사라졌다. 반대로 admin 환불 경로는 status 를 안 건드려 fulfilled 로
--   남아 매출에 과대계상됐다. 두 경로를 'refunded' 종료 상태로 통일하고, 매출과 환불액을
--   분리 집계한다(revenue_won 은 판 날 그대로, refunded_won 은 환불한 날에).
--
-- ⚠️ 프로덕션 수동 적용(supabase db push). 070_email_notifications 미적용 상태이면 함께 적용된다.

-- 1) payment_orders.status CHECK 에 'refunded' 추가.
alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders add constraint payment_orders_status_check check (
  status in (
    'prepared',
    'in_progress',
    'confirmed',
    'fulfilling',
    'fulfilled',
    'payment_failed',
    'fulfillment_failed',
    'canceled',
    'refunded',
    'expired'
  )
);

-- 2) 환불 시각. failed_at(취소/실패)과 분리 — 결제까지 갔던 주문의 환불 시점.
alter table public.payment_orders add column if not exists refunded_at timestamptz;

comment on column public.payment_orders.refunded_at is
  '결제 성공분이 환불된 시각. status=refunded 와 함께 기록. 매출 집계에서 환불액 귀속일.';

-- 3) 일별 지표에 환불 건수·금액. 매출(revenue_won)과 분리 → net = revenue − refunded.
alter table public.metrics_daily add column if not exists refunded_orders integer not null default 0;
alter table public.metrics_daily add column if not exists refunded_won bigint not null default 0;

comment on column public.metrics_daily.refunded_won is
  '환불 발생일(refunded_at) 기준 환불액 합. revenue_won 은 판 날 유지, net 은 조회 시 계산.';
