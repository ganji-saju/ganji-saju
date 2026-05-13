-- P0-1 fix (audit 2026-05-13): 결제 confirm 흐름의 코인 적립을 paymentKey 기준으로 멱등화한다.
-- 같은 paymentKey로 /api/payments/confirm 이 두 번 호출되어도 코인은 단 한 번만 적립되어야 한다.
-- 015_idempotent_credit_unlocks.sql 와 동일한 metadata @> 패턴을 사용한다.

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
  v_payment_key TEXT;
  v_existing_id UUID;
BEGIN
  v_payment_key := NULLIF(p_metadata->>'paymentKey', '');

  -- paymentKey 가 동봉된 호출은 결제 confirm 경로이므로 멱등 보장이 필요하다.
  IF v_payment_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND type = p_type
      AND metadata->>'paymentKey' = v_payment_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO user_credits (user_id, balance, subscription_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_type = 'subscription' THEN
    UPDATE user_credits
    SET subscription_balance = subscription_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE user_credits
    SET balance = balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, type, metadata)
  VALUES (p_user_id, p_amount, p_type, p_metadata);
END;
$$;

-- paymentKey 기반 조회 인덱스 — 멱등 체크 매 호출 시 비용 최소화
CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_key
  ON credit_transactions ((metadata->>'paymentKey'))
  WHERE metadata ? 'paymentKey';
