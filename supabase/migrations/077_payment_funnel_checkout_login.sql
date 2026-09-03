-- 2026-09-03 — payment_funnel_events 에 'checkout_viewed' · 'login_required' · 'login_returned' 추가.
--
-- 왜: 퍼널 가운데 두 칸이 통째로 비어 있었다. 기록은 페이월 노출(paywall_viewed) 다음이
--   바로 prepare_attempt(결제 시작) 인데, 그 사이에 **결제 화면 도달**과 **로그인 벽**이 있다.
--   게다가 결제 버튼을 눌러도 미로그인이면 클라이언트가 /login 으로 보내고 prepare 를
--   **아예 호출하지 않는다**(toss-membership-checkout.tsx) — 즉 로그인 벽에서 튕긴 사람은
--   퍼널에 흔적이 0이다.
--
--   2026-09-03 실측: 페이월 노출 271~800/일 · 체크아웃 도달 1~5명/일 · 결제 시도 0~4/일.
--   "어디서 죽는지"를 물었을 때 답할 수 없었던 이유가 이 빈칸이다.
--
-- 이제 이어진다:
--   paywall_viewed → checkout_viewed → (login_required → login_returned) → prepare_attempt
--   → prepare_ready → confirm_attempt → confirm_success/failed
--
-- 집계 팁: login_required 는 **결제 의사를 밝힌 순간**이다. 이 값이 크고 login_returned 가
--   작으면 로그인 벽이 이탈 원인이라는 뜻이다(둘의 차이가 곧 손실).
ALTER TABLE payment_funnel_events DROP CONSTRAINT IF EXISTS payment_funnel_events_stage_check;

ALTER TABLE payment_funnel_events ADD CONSTRAINT payment_funnel_events_stage_check
  CHECK (stage IN (
    'paywall_viewed',
    'checkout_viewed',
    'login_required',
    'login_returned',
    'prepare_attempt',
    'prepare_blocked',
    'prepare_ready',
    'confirm_attempt',
    'confirm_success',
    'confirm_failed'
  ));

COMMENT ON COLUMN payment_funnel_events.stage IS
  'paywall_viewed(페이월 노출) → checkout_viewed(결제화면 도달) → login_required(로그인 벽에 튕김) → login_returned(로그인 후 복귀) → prepare_attempt → prepare_ready → confirm_attempt → confirm_success/failed. prepare_blocked 는 사전 차단.';
