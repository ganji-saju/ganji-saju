-- 2026-05-27 — Toss credit/subscription credit confirm idempotency.
--
-- Problem: /api/payments/confirm can be retried with the same Toss paymentKey/orderId.
-- Entitlement grants are protected by unique product scope constraints, but add_credits
-- previously had no paymentKey-level lock and could double-add coin balances.
--
-- Model: processed_credit_payments reserves each Toss paymentKey before adding credits.
-- The unique payment_key constraint is the concurrency lock. Existing credit transactions
-- are backfilled so old successful payments cannot be credited again after this migration.

CREATE TABLE IF NOT EXISTS public.processed_credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  payment_key TEXT NOT NULL UNIQUE,
  order_id TEXT,
  package_id TEXT,
  amount INT NOT NULL CHECK (amount > 0),
  credit_type TEXT NOT NULL CHECK (credit_type IN ('purchase', 'subscription')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processed_credit_payments_user_idx
  ON public.processed_credit_payments (user_id, created_at DESC);

COMMENT ON TABLE public.processed_credit_payments IS
  'Idempotency ledger for Toss payments that grant credits. One payment_key can credit balances only once.';
COMMENT ON COLUMN public.processed_credit_payments.payment_key IS
  'Toss paymentKey. Unique lock used by add_credits to prevent duplicate credit grants on confirm retry.';

ALTER TABLE public.processed_credit_payments ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: server/service role only.

INSERT INTO public.processed_credit_payments (
  user_id,
  payment_key,
  order_id,
  package_id,
  amount,
  credit_type,
  metadata,
  created_at
)
SELECT DISTINCT ON (payment_key)
  user_id,
  payment_key,
  NULLIF(metadata->>'orderId', '') AS order_id,
  NULLIF(metadata->>'packageId', '') AS package_id,
  amount,
  type AS credit_type,
  COALESCE(metadata, '{}'::jsonb) AS metadata,
  created_at
FROM (
  SELECT
    id,
    user_id,
    amount,
    type,
    COALESCE(metadata, '{}'::jsonb) AS metadata,
    created_at,
    NULLIF(COALESCE(metadata, '{}'::jsonb)->>'paymentKey', '') AS payment_key
  FROM public.credit_transactions
  WHERE amount > 0
    AND type IN ('purchase', 'subscription')
) existing
WHERE payment_key IS NOT NULL
ORDER BY payment_key, created_at ASC, id ASC
ON CONFLICT (payment_key) DO NOTHING;

CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INT,
  p_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_metadata JSONB;
  v_payment_key TEXT;
  v_order_id TEXT;
  v_package_id TEXT;
  v_inserted_payment_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN;
  END IF;

  v_metadata := COALESCE(p_metadata, '{}'::jsonb);
  v_payment_key := NULLIF(v_metadata->>'paymentKey', '');
  v_order_id := NULLIF(v_metadata->>'orderId', '');
  v_package_id := NULLIF(v_metadata->>'packageId', '');

  INSERT INTO public.user_credits (user_id, balance, subscription_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_payment_key IS NOT NULL THEN
    INSERT INTO public.processed_credit_payments (
      user_id,
      payment_key,
      order_id,
      package_id,
      amount,
      credit_type,
      metadata
    )
    VALUES (
      p_user_id,
      v_payment_key,
      v_order_id,
      v_package_id,
      p_amount,
      COALESCE(NULLIF(p_type, ''), 'purchase'),
      v_metadata
    )
    ON CONFLICT (payment_key) DO NOTHING
    RETURNING id INTO v_inserted_payment_id;

    IF v_inserted_payment_id IS NULL THEN
      -- Already processed. Treat as idempotent success without mutating balances
      -- or appending another credit_transactions row.
      RETURN;
    END IF;
  END IF;

  IF p_type = 'subscription' THEN
    -- Managed membership credit grant. Existing subscription_balance behavior preserved.
    UPDATE public.user_credits
    SET subscription_balance = subscription_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Paid coin pack. 040_credit_lots_expiry makes this a 1-year expiring lot.
    PERFORM add_credit_lot(
      p_user_id,
      p_amount,
      now() + interval '1 year',
      COALESCE(NULLIF(p_type, ''), 'purchase'),
      v_metadata
    );
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, metadata)
  VALUES (p_user_id, p_amount, COALESCE(NULLIF(p_type, ''), 'purchase'), v_metadata);
END;
$$;
