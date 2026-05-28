-- 2026-05-28 — 오늘운세 유료 다시보기 전용 결과 스냅샷.
--
-- Live today-detail routes may recalculate for the current KST day, but vault
-- replays must preserve the exact paid/unlocked result payload.

CREATE TABLE IF NOT EXISTS public.today_fortune_result_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  reading_id UUID REFERENCES public.readings(id) ON DELETE SET NULL,
  reading_key TEXT NOT NULL,
  source_session_id TEXT,
  source_slug TEXT,
  scope_key TEXT NOT NULL,
  occurred_on DATE NOT NULL,
  concern_id TEXT NOT NULL DEFAULT 'general',
  counselor_id TEXT,
  input_json JSONB NOT NULL DEFAULT '{}',
  free_result_json JSONB NOT NULL DEFAULT '{}',
  premium_result_json JSONB NOT NULL DEFAULT '{}',
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  snapshot_version TEXT NOT NULL DEFAULT 'today-fortune-result-snapshot/v1',
  builder_version TEXT NOT NULL DEFAULT 'today-fortune-builder/v1',
  access_source TEXT,
  entitlement_id UUID REFERENCES public.product_entitlements(id) ON DELETE SET NULL,
  payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  payment_key TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.today_fortune_result_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "본인 오늘운세 결과 스냅샷 조회" ON public.today_fortune_result_snapshots;
CREATE POLICY "본인 오늘운세 결과 스냅샷 조회" ON public.today_fortune_result_snapshots
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS today_fortune_result_snapshots_user_scope_uidx
  ON public.today_fortune_result_snapshots (user_id, scope_key);

CREATE INDEX IF NOT EXISTS today_fortune_result_snapshots_user_created_idx
  ON public.today_fortune_result_snapshots (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS today_fortune_result_snapshots_user_day_idx
  ON public.today_fortune_result_snapshots (user_id, occurred_on DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS today_fortune_result_snapshots_reading_day_idx
  ON public.today_fortune_result_snapshots (reading_key, occurred_on DESC);

CREATE OR REPLACE FUNCTION public.set_today_fortune_result_snapshots_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS today_fortune_result_snapshots_set_updated_at
  ON public.today_fortune_result_snapshots;
CREATE TRIGGER today_fortune_result_snapshots_set_updated_at
  BEFORE UPDATE ON public.today_fortune_result_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_today_fortune_result_snapshots_updated_at();

COMMENT ON TABLE public.today_fortune_result_snapshots IS
  'Immutable paid/unlocked today-fortune result payloads for vault replay.';
COMMENT ON COLUMN public.today_fortune_result_snapshots.scope_key IS
  'Per-paid-day key: today-detail:{readingKey}:{YYYY-MM-DD}:{concernId}.';
