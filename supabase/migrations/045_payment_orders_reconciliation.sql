-- 2026-05-27 — Payment order ledger + Toss webhook/reconciliation support.
--
-- Purpose:
--   - orderId is generated and persisted server-side during /api/payments/prepare.
--   - confirm/webhook/reconciliation all reconcile against the same payment_orders row.
--   - fulfillment is claimed atomically so subscription periods and grants are not applied twice.

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (
    status IN (
      'prepared',
      'in_progress',
      'confirmed',
      'fulfilling',
      'fulfilled',
      'payment_failed',
      'fulfillment_failed',
      'canceled',
      'expired'
    )
  ),
  payment_key TEXT,
  toss_status TEXT,
  toss_payment JSONB,
  slug TEXT,
  scope TEXT,
  product TEXT,
  plan TEXT,
  entry_source TEXT,
  payment_method_code TEXT,
  accepted_policy_kinds TEXT[] NOT NULL DEFAULT '{}',
  recorded_policy_version_ids UUID[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  last_error TEXT,
  fulfillment_attempts INT NOT NULL DEFAULT 0,
  reconciliation_attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '45 minutes'),
  confirmed_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (order_id ~ '^[A-Za-z0-9_-]{6,64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_payment_key_uidx
  ON public.payment_orders (payment_key)
  WHERE payment_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_orders_user_created_idx
  ON public.payment_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_orders_status_updated_idx
  ON public.payment_orders (status, updated_at);

CREATE INDEX IF NOT EXISTS payment_orders_reconciliation_idx
  ON public.payment_orders (status, last_reconciled_at, created_at);

COMMENT ON TABLE public.payment_orders IS
  'Server-issued Toss orderId ledger. prepare, confirm, webhook, and reconciliation use this as the payment source of truth.';
COMMENT ON COLUMN public.payment_orders.order_id IS
  'Server-generated Toss orderId. Unique, 6-64 chars, alphanumeric plus dash/underscore.';
COMMENT ON COLUMN public.payment_orders.status IS
  'Internal payment lifecycle status. External Toss state is stored in toss_status/toss_payment.';

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- No user-facing policy: app routes use service_role and explicitly check user_id.

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_hash TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_created_at TIMESTAMPTZ,
  order_id TEXT,
  payment_key TEXT,
  payment_status TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (
    processing_status IN ('received', 'processed', 'ignored', 'failed')
  ),
  raw_payload JSONB NOT NULL,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_order_idx
  ON public.payment_webhook_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx
  ON public.payment_webhook_events (processing_status, created_at DESC);

COMMENT ON TABLE public.payment_webhook_events IS
  'Deduplicated raw Toss webhook event ledger. Payload is verified against Toss APIs before fulfillment.';

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- No user-facing policy: server/service role only.

CREATE OR REPLACE FUNCTION public.set_payment_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_orders_set_updated_at ON public.payment_orders;
CREATE TRIGGER payment_orders_set_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_orders_updated_at();

CREATE OR REPLACE FUNCTION public.claim_payment_order_fulfillment(p_order_id TEXT)
RETURNS public.payment_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.payment_orders;
BEGIN
  UPDATE public.payment_orders
  SET
    status = 'fulfilling',
    fulfillment_attempts = fulfillment_attempts + 1,
    last_error = NULL
  WHERE order_id = p_order_id
    AND (
      status IN ('prepared', 'in_progress', 'confirmed', 'fulfillment_failed')
      OR (status = 'fulfilling' AND updated_at < now() - interval '10 minutes')
    )
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payment_order_reconciliation_attempt(p_order_id TEXT)
RETURNS public.payment_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.payment_orders;
BEGIN
  UPDATE public.payment_orders
  SET
    reconciliation_attempts = reconciliation_attempts + 1,
    last_reconciled_at = now()
  WHERE order_id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;
