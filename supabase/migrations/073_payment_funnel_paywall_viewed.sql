-- 2026-08-12 — payment_funnel_events 에 'paywall_viewed' 단계 추가.
--
-- 왜: 지금까지 퍼널의 **첫 칸이 비어 있었다.** 기록은 prepare_attempt(결제창 도달)부터
--   시작해서, "사주 결과를 본 사람 중 몇 %가 페이월을 봤나"를 계산할 수 없었다.
--   무료 조회수(readings)와 결제 퍼널은 서로 다른 테이블이라 조인도 안 됐다.
--   그래서 "무료가 좋아서 결제를 안 한다"는 가설을 60일간 검증할 수 없었다.
--
-- 이제 같은 테이블 안에서 paywall_viewed → prepare_attempt → confirm_success 로 이어진다.
--
-- 집계 팁: 한 리포트를 여러 번 새로고침하면 노출도 여러 번 쌓인다.
--   고유 리포트 기준 분모가 필요하면 count(distinct metadata->>'slug') 를 쓸 것.
ALTER TABLE payment_funnel_events DROP CONSTRAINT IF EXISTS payment_funnel_events_stage_check;

ALTER TABLE payment_funnel_events ADD CONSTRAINT payment_funnel_events_stage_check
  CHECK (stage IN (
    'paywall_viewed',
    'prepare_attempt',
    'prepare_blocked',
    'prepare_ready',
    'confirm_attempt',
    'confirm_success',
    'confirm_failed'
  ));

COMMENT ON COLUMN payment_funnel_events.stage IS
  'paywall_viewed(페이월 노출) → prepare_attempt → prepare_ready → confirm_attempt → confirm_success/failed. prepare_blocked 는 사전 차단.';
