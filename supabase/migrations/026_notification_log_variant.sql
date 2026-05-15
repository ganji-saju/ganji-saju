-- 2026-05-16 — notification_delivery_logs A/B 본문 variant + 클릭 ack 컬럼.
-- PR #136: 별자리 push 의 본문 후보 3개 (top sign / best element / caution) 중
-- 사용자별 PRNG 로 결정적 선택. 어떤 variant 가 발송됐는지 + 사용자가 클릭했는지
-- 로깅하여 향후 클릭률 측정 + 후속 A/B 분석에 사용.

-- variant: 'A' | 'B' | 'C' (별자리), 다른 슬롯은 NULL.
ALTER TABLE notification_delivery_logs
  ADD COLUMN IF NOT EXISTS variant TEXT
    CHECK (variant IN ('A', 'B', 'C') OR variant IS NULL);

-- 클릭 ack 시각 — 본 PR 에서는 컬럼만 추가, 다음 PR 에서 API 통해 set.
ALTER TABLE notification_delivery_logs
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

-- 분석용 인덱스 — slot_key + variant + created_at.
CREATE INDEX IF NOT EXISTS idx_notification_logs_slot_variant
  ON notification_delivery_logs (slot_key, variant, created_at DESC)
  WHERE variant IS NOT NULL;
