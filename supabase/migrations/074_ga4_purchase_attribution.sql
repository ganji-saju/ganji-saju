-- 074_ga4_purchase_attribution.sql
-- 날짜: 2026-08-26
-- 목적: 결제를 '원래 유입 채널'에 귀속시키기 위한 GA4 식별자 보관.
--
-- 배경: 결제 확정은 서버(나이스페이 복귀/웹훅)에서 일어나는데, 그 시점에는 브라우저가
--   없거나 세션이 끊겨 있다. 브라우저에서 purchase 를 쏘면 완료 페이지 이탈·새로고침·
--   광고차단으로 5~20% 가 누락되고 가상계좌는 전량 누락된다. 그래서 결제 시작 시점에
--   GA4 의 client_id·session_id 를 주문에 붙여 두고, 확정 시 서버가 Measurement Protocol 로
--   전송한다. session_id 를 안 실으면 GA4 가 그 결제를 '새 세션 / (direct)' 로 처리해
--   **매출은 잡히는데 채널별 매출이 전부 Direct 로 몰린다.**
--
-- ⚠️ 프로덕션 수동 적용(supabase db push).

alter table public.payment_orders add column if not exists ga_client_id text;
alter table public.payment_orders add column if not exists ga_session_id text;
alter table public.payment_orders add column if not exists ga_purchase_sent_at timestamptz;
alter table public.payment_orders add column if not exists ga_refund_sent_at timestamptz;
-- 분석 동의 상태. denied 면 서버 전송도 하지 않는다 — 브라우저만 막고 서버로 우회하면
-- 동의 배너가 거짓말이 된다(Consent Mode 우회 방지).
alter table public.payment_orders add column if not exists analytics_consent text;

comment on column public.payment_orders.ga_client_id is
  'GA4 client_id(_ga 쿠키). 결제 시작 시 스냅샷. 없으면 MP 전송을 건너뛴다(Direct 오염 방지).';
comment on column public.payment_orders.ga_session_id is
  'GA4 session_id(_ga_<streamId> 쿠키). 채널 귀속의 핵심 — 없으면 GA4 가 새 세션/Direct 로 처리.';
comment on column public.payment_orders.ga_purchase_sent_at is
  'MP purchase 전송 시각. 선점 update 로 웹훅 재전송 시 중복 발사를 막는 멱등 플래그.';
comment on column public.payment_orders.ga_refund_sent_at is
  'MP refund 전송 시각. purchase 와 동일한 멱등 계약.';
comment on column public.payment_orders.analytics_consent is
  '결제 시작 시점의 분석 동의 상태(granted/denied/unknown). denied 면 MP 전송 안 함.';

-- 미전송 주문 모니터링용. '확정됐는데 GA 로 안 나간 주문' 을 싸게 찾는다.
create index if not exists payment_orders_ga_pending_idx
  on public.payment_orders (status, ga_purchase_sent_at)
  where ga_purchase_sent_at is null;
