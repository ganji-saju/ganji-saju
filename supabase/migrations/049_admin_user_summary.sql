-- 2026-06-06 M1 — 가입자 관리 대시보드 목록용 사전계산 요약 테이블.
--   목록/정렬/필터/검색을 단일 테이블 keyset 쿼리로 처리(N+1 회피).
--   매시간 배치(refreshAdminUserSummary, TS)로 갱신. service_role 만 접근.
CREATE TABLE IF NOT EXISTS admin_user_summary (
  user_id             UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email               TEXT,
  display_name        TEXT,
  signup_at           TIMESTAMPTZ NOT NULL,
  signup_provider     TEXT,
  profile_complete    BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at      TIMESTAMPTZ NOT NULL,
  ltv_won             BIGINT NOT NULL DEFAULT 0,
  paid_count          INT NOT NULL DEFAULT 0,
  credit_balance      INT NOT NULL DEFAULT 0,
  credit_expiring     INT NOT NULL DEFAULT 0,
  subscription_status TEXT,            -- active|cancelled|expired, NULL=구독 없음
  refundable_won      BIGINT NOT NULL DEFAULT 0,
  reading_count       INT NOT NULL DEFAULT 0,
  chat_count          INT NOT NULL DEFAULT 0,
  refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- keyset 정렬 인덱스((정렬키, user_id) 복합, 모두 DESC 스캔).
CREATE INDEX IF NOT EXISTS admin_user_summary_signup_idx      ON admin_user_summary (signup_at DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_ltv_idx         ON admin_user_summary (ltv_won DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_last_active_idx ON admin_user_summary (last_active_at DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_paid_idx        ON admin_user_summary (paid_count DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_email_idx       ON admin_user_summary (email text_pattern_ops);

-- RLS: 정책 미생성 = 전면 deny. service_role 은 RLS 우회하므로 admin 데이터레이어만 접근.
ALTER TABLE admin_user_summary ENABLE ROW LEVEL SECURITY;
