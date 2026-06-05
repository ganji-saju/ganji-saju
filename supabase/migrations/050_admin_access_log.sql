-- 2026-06-06 M1 — 어드민 민감 열람/운영 액션 감사 로그.
--   M1: export_csv 기록. M3/M4: view_detail, view_pii, 운영 쓰기 액션.
--   보유기간: 기본 12개월 후 purge(별도 배치, C2 정책). 환불 감사는 장기보관 검토.
CREATE TABLE IF NOT EXISTS admin_access_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID NOT NULL REFERENCES auth.users,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,        -- view_detail|view_pii|export_csv|grant_credit|revoke_credit|suspend_sub|cancel_sub|force_reconsent|refund_request|refund_approve|batch_refund_request|purge_deleted_user
  target_user UUID,
  reason      TEXT,
  meta        JSONB,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_access_log_target_idx ON admin_access_log (target_user, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_access_log_actor_idx  ON admin_access_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_access_log_action_idx ON admin_access_log (action, created_at DESC);

-- RLS: 전면 deny(정책 미생성). service_role write, super_admin read 는 데이터레이어에서 통제.
ALTER TABLE admin_access_log ENABLE ROW LEVEL SECURITY;
