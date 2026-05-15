-- 2026-05-16 PR (B1) — 결제 funnel 이벤트 로그 테이블.
-- /credits → prepare → confirm 흐름의 각 단계를 기록해 admin 대시보드에서
-- 일별 step-by-step conversion / drop-off / 실패 사유를 본다.
--
-- 단계:
--   'prepare_attempt'     — POST /api/payments/prepare 진입
--   'prepare_blocked'     — 미로그인 / 이미 구매 등으로 결제 화면 진입 차단
--   'prepare_ready'       — 결제 가능 상태 응답 (사용자 결제 시도 가능)
--   'confirm_attempt'     — POST /api/payments/confirm 진입
--   'confirm_success'     — 결제 성공
--   'confirm_failed'      — 토스 결제 승인 또는 후속 처리 실패
--
-- created_at 인덱스 + (stage, created_at) 복합 인덱스로 일별 윈도우 집계 최적화.

CREATE TABLE IF NOT EXISTS payment_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL CHECK (stage IN (
    'prepare_attempt',
    'prepare_blocked',
    'prepare_ready',
    'confirm_attempt',
    'confirm_success',
    'confirm_failed'
  )),
  package_id TEXT,
  amount INTEGER,
  reason TEXT,
  order_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_funnel_events_created_at_idx
  ON payment_funnel_events (created_at DESC);

CREATE INDEX IF NOT EXISTS payment_funnel_events_stage_created_at_idx
  ON payment_funnel_events (stage, created_at DESC);

COMMENT ON TABLE payment_funnel_events IS
  'B1 — 결제 funnel 이벤트 로그. /credits → prepare → confirm 의 단계별 진입/차단/성공/실패 기록.';
COMMENT ON COLUMN payment_funnel_events.stage IS
  '결제 단계 — prepare_attempt / prepare_blocked / prepare_ready / confirm_attempt / confirm_success / confirm_failed';
COMMENT ON COLUMN payment_funnel_events.reason IS
  'prepare_blocked: unauthenticated|active_subscription|existing_entitlement|existing_credit_unlock 등. '
  'confirm_failed: toss API 에러 코드 또는 후속 처리 단계 실패 사유.';
COMMENT ON COLUMN payment_funnel_events.metadata IS
  '추가 컨텍스트 (예: scope, slug, product). admin 분석 시 필요한 경우만 채움.';

-- RLS — admin 만 select. service-role 은 무제한.
ALTER TABLE payment_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_funnel_events admin select"
  ON payment_funnel_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
