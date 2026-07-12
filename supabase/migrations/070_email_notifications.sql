-- Email is an explicit opt-in channel and remains independent from web-push subscriptions.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS notification_email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  slot_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  provider_message_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_email_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 이메일 발송 로그 조회" ON notification_email_delivery_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notification_email_logs_user
  ON notification_email_delivery_logs (user_id, created_at DESC);
