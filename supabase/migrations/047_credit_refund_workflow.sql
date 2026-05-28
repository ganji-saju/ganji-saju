-- 2026-05-27 — Coin purchase refund workflow.
--
-- Adds a first-class refund kind for paid coin packs. Product refunds revoke
-- product_entitlements; coin refunds revoke remaining credit_lots for the same
-- Toss paymentKey and keep processed_credit_payments intact so confirm retries
-- cannot re-grant refunded coins.

ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS refund_kind TEXT NOT NULL DEFAULT 'product'
    CHECK (refund_kind IN ('product', 'credit_purchase')),
  ADD COLUMN IF NOT EXISTS credit_transaction_id UUID REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_amount INTEGER CHECK (credit_amount IS NULL OR credit_amount >= 0),
  ADD COLUMN IF NOT EXISTS original_amount INTEGER CHECK (original_amount IS NULL OR original_amount >= 0),
  ADD COLUMN IF NOT EXISTS refund_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_active_credit_tx_uidx
  ON public.refund_requests (credit_transaction_id)
  WHERE credit_transaction_id IS NOT NULL
    AND status IN ('requested', 'processing', 'completed', 'failed', 'revoke_pending');

CREATE INDEX IF NOT EXISTS credit_transactions_purchase_payment_key_idx
  ON public.credit_transactions ((metadata->>'paymentKey'))
  WHERE type = 'purchase'
    AND metadata ? 'paymentKey';

CREATE INDEX IF NOT EXISTS credit_lots_purchase_payment_key_idx
  ON public.credit_lots ((metadata->>'paymentKey'))
  WHERE source = 'purchase'
    AND metadata ? 'paymentKey';

CREATE OR REPLACE FUNCTION public.revoke_credit_purchase_lots(
  p_user_id UUID,
  p_payment_key TEXT,
  p_refund_request_id UUID DEFAULT NULL,
  p_refund_amount INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT '',
  p_actor UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_payment_key TEXT;
  v_amount_initial INTEGER := 0;
  v_credit_amount INTEGER := 0;
  v_order_id TEXT;
  v_package_id TEXT;
  v_audit_id UUID;
BEGIN
  v_payment_key := NULLIF(btrim(COALESCE(p_payment_key, '')), '');
  IF v_payment_key IS NULL THEN
    RAISE EXCEPTION 'payment_key is required';
  END IF;

  IF p_refund_request_id IS NOT NULL THEN
    SELECT id
    INTO v_audit_id
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND type = 'purchase'
      AND feature = 'credit_refund'
      AND metadata @> jsonb_build_object('refundRequestId', p_refund_request_id::TEXT)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Serialize with normal credit consumption/grants via the user_credits row.
  INSERT INTO public.user_credits (user_id, balance, subscription_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  PERFORM 1
  FROM public.credit_lots
  WHERE user_id = p_user_id
    AND source = 'purchase'
    AND metadata->>'paymentKey' = v_payment_key
    AND expires_at > now()
  FOR UPDATE;

  SELECT
    COALESCE(SUM(amount_initial), 0)::INTEGER,
    COALESCE(SUM(amount_remaining), 0)::INTEGER,
    MAX(metadata->>'orderId'),
    MAX(metadata->>'packageId')
  INTO v_amount_initial, v_credit_amount, v_order_id, v_package_id
  FROM public.credit_lots
  WHERE user_id = p_user_id
    AND source = 'purchase'
    AND metadata->>'paymentKey' = v_payment_key
    AND expires_at > now();

  IF v_credit_amount <= 0 THEN
    PERFORM public.sync_credit_balance_from_lots(p_user_id);
    RETURN jsonb_build_object(
      'revoked', v_audit_id IS NOT NULL,
      'paymentKey', v_payment_key,
      'creditAmount', 0,
      'amountInitial', v_amount_initial,
      'refundAmount', p_refund_amount,
      'auditId', v_audit_id,
      'reason', CASE WHEN v_audit_id IS NOT NULL THEN 'already_revoked' ELSE 'no_refundable_credits' END
    );
  END IF;

  UPDATE public.credit_lots
  SET amount_remaining = 0
  WHERE user_id = p_user_id
    AND source = 'purchase'
    AND metadata->>'paymentKey' = v_payment_key
    AND expires_at > now()
    AND amount_remaining > 0;

  PERFORM public.sync_credit_balance_from_lots(p_user_id);

  INSERT INTO public.credit_transactions (user_id, amount, type, feature, metadata)
  VALUES (
    p_user_id,
    0,
    'purchase',
    'credit_refund',
    jsonb_build_object(
      'kind', 'credit_refund',
      'refundRequestId', p_refund_request_id,
      'paymentKey', v_payment_key,
      'orderId', v_order_id,
      'packageId', v_package_id,
      'creditAmount', v_credit_amount,
      'amountInitial', v_amount_initial,
      'refundAmount', p_refund_amount,
      'reason', COALESCE(p_reason, ''),
      'actor', p_actor,
      'revokedAt', now()
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'revoked', TRUE,
    'paymentKey', v_payment_key,
    'creditAmount', v_credit_amount,
    'amountInitial', v_amount_initial,
    'refundAmount', p_refund_amount,
    'auditId', v_audit_id
  );
END;
$$;
