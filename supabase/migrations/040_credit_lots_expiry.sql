-- 2026-05-25 — 결제 코인 1년 유효기간(lot 기반 만료) 도입.
--
-- 배경: FAQ 는 "결제 코인은 1년간 유효"라고 안내하지만 구현은 무만료였다.
--   이 불일치를 lot(매입 단위) 기반 compute-on-read 모델로 해소한다.
--
-- 결정(주어짐): grandfather = 시행일 + 1년.
--   - 기존 user_credits.balance 잔액은 이 마이그레이션 적용 시점 + 1년에 만료(즉시 소실 없음).
--   - 신규 결제 코인은 결제 시점 + 1년에 만료.
--   - 구독 지급 코인(subscription_balance)은 기존 동작 유지(구독과 함께 만료) — 변경하지 않는다.
--
-- 모델: credit_lots 테이블이 "비만료 충전 단위"의 진실 원천(source of truth).
--   user_credits.balance 는 비만료 lot 의 amount_remaining 합으로 항상 재계산되는 캐시값으로 격하된다.
--   (compute-on-read 가 원천 — 별도 cleanup cron 없이도 만료분이 잔액에서 제외됨. cron 은 선택사항.)
--
-- 멱등: 테이블/인덱스는 IF NOT EXISTS. grandfather 백필은 source='grandfather' 가
--   해당 유저에 이미 있으면 건너뛰어(WHERE NOT EXISTS) 재실행해도 중복 lot 을 만들지 않는다.

-- ── 1. credit_lots 테이블 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- 이 lot 에 남은 코인 수(차감 시 감소, 0 이상 유지).
  amount_remaining INT NOT NULL CHECK (amount_remaining >= 0),
  -- 최초 충전량(감사/디버그용 — 비즈니스 로직은 amount_remaining 만 사용).
  amount_initial INT NOT NULL CHECK (amount_initial >= 0),
  -- 만료 시각. 이 시각 이후에는 잔액 계산/차감에서 제외된다.
  expires_at TIMESTAMPTZ NOT NULL,
  -- 'purchase' | 'grandfather' (향후 'promo' 등 확장 가능).
  source TEXT NOT NULL DEFAULT 'purchase',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FIFO(가장 먼저 만료되는 lot 우선) 차감 + 비만료 합 계산에 쓰는 핵심 인덱스.
CREATE INDEX IF NOT EXISTS idx_credit_lots_user_expiry
  ON public.credit_lots (user_id, expires_at);

-- grandfather 백필 멱등 체크(user_id, source) 조회 가속.
CREATE INDEX IF NOT EXISTS idx_credit_lots_user_source
  ON public.credit_lots (user_id, source);

COMMENT ON TABLE public.credit_lots IS
  '결제/이관 코인의 만료 단위(lot). 비만료 lot 의 amount_remaining 합이 user_credits.balance 의 진실값. subscription_balance 는 무관.';
COMMENT ON COLUMN public.credit_lots.amount_remaining IS
  '이 lot 의 잔여 코인. deduct 시 FIFO(expires_at ASC)로 감소. 만료된 lot 은 잔액/차감에서 제외(값은 보존).';
COMMENT ON COLUMN public.credit_lots.expires_at IS
  '만료 시각. now() 초과 시 잔액 계산과 차감 대상에서 제외.';
COMMENT ON COLUMN public.credit_lots.source IS
  'purchase=결제 충전(결제+1년), grandfather=시행일 백필(시행일+1년).';

-- RLS — user_credits 와 동일 패턴: 본인 lot 만 SELECT, 쓰기는 service_role(SECURITY DEFINER 함수) 전용.
ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "본인 코인 lot 조회" ON public.credit_lots;
CREATE POLICY "본인 코인 lot 조회" ON public.credit_lots
  FOR SELECT USING (auth.uid() = user_id);

-- ── 2. grandfather 백필 ────────────────────────────────────────────────
-- 기존 balance > 0 유저마다 lot 1개 생성(amount_remaining = 현재 balance, 만료 = now()+1년).
-- 이미 grandfather lot 이 있으면 건너뛴다(재실행 안전).
INSERT INTO public.credit_lots (user_id, amount_remaining, amount_initial, expires_at, source, metadata)
SELECT
  uc.user_id,
  uc.balance,
  uc.balance,
  now() + interval '1 year',
  'grandfather',
  jsonb_build_object('backfilledAt', now(), 'migration', '040_credit_lots_expiry')
FROM public.user_credits uc
WHERE uc.balance > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.credit_lots cl
    WHERE cl.user_id = uc.user_id
      AND cl.source = 'grandfather'
  );

-- ── 3. 비만료 lot 합 계산 헬퍼 ─────────────────────────────────────────
-- user_credits.balance 를 비만료 lot 합으로 재계산(차감/충전 후 호출해 캐시 동기화).
CREATE OR REPLACE FUNCTION sync_credit_balance_from_lots(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sum INT;
BEGIN
  SELECT COALESCE(SUM(amount_remaining), 0)
  INTO v_sum
  FROM public.credit_lots
  WHERE user_id = p_user_id
    AND expires_at > now();

  UPDATE public.user_credits
  SET balance = v_sum,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_sum;
END;
$$;

-- ── 4. lot 추가(결제 충전) ─────────────────────────────────────────────
-- 결제 코인은 결제 시점 + 1년 만료 lot 으로 적립. user_credits.balance(비만료 합)도 갱신.
CREATE OR REPLACE FUNCTION add_credit_lot(
  p_user_id UUID,
  p_amount INT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_source TEXT DEFAULT 'purchase',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_balance INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN sync_credit_balance_from_lots(p_user_id);
  END IF;

  v_expires_at := COALESCE(p_expires_at, now() + interval '1 year');

  INSERT INTO public.user_credits (user_id, balance, subscription_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- user_credits 행을 잠가 동시 차감/충전과 직렬화(deduct 와 같은 잠금 지점).
  PERFORM 1 FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

  INSERT INTO public.credit_lots (user_id, amount_remaining, amount_initial, expires_at, source, metadata)
  VALUES (p_user_id, p_amount, p_amount, v_expires_at, p_source, COALESCE(p_metadata, '{}'::jsonb));

  v_balance := sync_credit_balance_from_lots(p_user_id);
  RETURN v_balance;
END;
$$;

-- ── 5. add_credits 재작성 ──────────────────────────────────────────────
-- purchase 타입은 lot 으로 적립(1년 만료). subscription 타입은 기존대로 subscription_balance 증가.
-- 거래 이력(credit_transactions)은 동일하게 남긴다.
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
BEGIN
  INSERT INTO public.user_credits (user_id, balance, subscription_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_type = 'subscription' THEN
    -- 구독 지급분 — 만료 없는 별도 잔액(기존 동작 유지).
    UPDATE public.user_credits
    SET subscription_balance = subscription_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- 결제/그 외 충전 — 1년 만료 lot 으로 적립(balance 는 lot 합으로 동기화됨).
    PERFORM add_credit_lot(
      p_user_id,
      p_amount,
      now() + interval '1 year',
      COALESCE(NULLIF(p_type, ''), 'purchase'),
      COALESCE(p_metadata, '{}'::jsonb)
    );
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, metadata)
  VALUES (p_user_id, p_amount, p_type, p_metadata);
END;
$$;

-- ── 6. 비만료 lot FIFO 차감 헬퍼 ───────────────────────────────────────
-- 호출자(deduct_credits / unlock_credit_feature_once)가 이미 user_credits 행을
-- FOR UPDATE 로 잠근 상태에서 호출한다. 비만료 lot 을 expires_at ASC(가장 먼저 만료되는 것
-- 우선)로 잠가 차감하고, 부족하면 아무것도 차감하지 않고 FALSE 를 반환한다.
-- 성공 시 balance 를 lot 합으로 재동기화한다.
CREATE OR REPLACE FUNCTION consume_credit_lots(
  p_user_id UUID,
  p_cost INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available INT;
  v_remaining INT;
  v_take INT;
  v_lot RECORD;
BEGIN
  IF p_cost <= 0 THEN
    RETURN TRUE;
  END IF;

  -- 비만료 lot 합 — 부족하면 즉시 거부(부분 차감 방지).
  SELECT COALESCE(SUM(amount_remaining), 0)
  INTO v_available
  FROM public.credit_lots
  WHERE user_id = p_user_id
    AND expires_at > now();

  IF v_available < p_cost THEN
    RETURN FALSE;
  END IF;

  v_remaining := p_cost;

  -- FIFO: 가장 먼저 만료되는 lot 부터 차감. 동시 차감 방지로 행 잠금.
  FOR v_lot IN
    SELECT id, amount_remaining
    FROM public.credit_lots
    WHERE user_id = p_user_id
      AND expires_at > now()
      AND amount_remaining > 0
    ORDER BY expires_at ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_lot.amount_remaining, v_remaining);

    UPDATE public.credit_lots
    SET amount_remaining = amount_remaining - v_take
    WHERE id = v_lot.id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  -- 위 합 체크가 통과했으므로 v_remaining = 0 이어야 한다(방어적 검증).
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'credit lot consumption underflow: % remaining for user %', v_remaining, p_user_id;
  END IF;

  PERFORM sync_credit_balance_from_lots(p_user_id);
  RETURN TRUE;
END;
$$;

-- ── 7. deduct_credits 재작성 ───────────────────────────────────────────
-- 차감 순서: subscription_balance 먼저(기존과 동일) → 그 다음 비만료 lot FIFO.
-- subscription_balance 와 lot 을 섞어 쓰지 않는다(원본도 한 쪽만 사용). 둘 다 부족하면 거부.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_cost INT,
  p_feature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub_balance INT;
  v_balance INT;
  v_consumed BOOLEAN;
BEGIN
  SELECT subscription_balance, balance
  INTO v_sub_balance, v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 유저 행이 없으면 잔액 0 으로 간주(원본은 NULL 비교로 두 분기 모두 실패 → else).
  v_sub_balance := COALESCE(v_sub_balance, 0);

  -- 1) 구독 크레딧 먼저 차감(기존 동작 유지).
  IF v_sub_balance >= p_cost THEN
    UPDATE public.user_credits
    SET subscription_balance = subscription_balance - p_cost,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions (user_id, amount, type, feature)
    VALUES (p_user_id, -p_cost, 'use', p_feature);

    -- 잔여 = 차감 후 구독잔액 + 비만료 lot 합(만료 제외한 실제 보유량).
    RETURN jsonb_build_object(
      'success', true,
      'remaining', (v_sub_balance - p_cost) + sync_credit_balance_from_lots(p_user_id)
    );
  END IF;

  -- 2) 비만료 lot FIFO 차감.
  v_consumed := consume_credit_lots(p_user_id, p_cost);

  IF v_consumed THEN
    INSERT INTO public.credit_transactions (user_id, amount, type, feature)
    VALUES (p_user_id, -p_cost, 'use', p_feature);

    -- consume_credit_lots 가 이미 balance 를 동기화함 → 다시 읽어 잔여 반환.
    SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'remaining', COALESCE(v_balance, 0));
  END IF;

  -- 3) 둘 다 부족 — 비만료 기준 잔여를 안내.
  RETURN jsonb_build_object(
    'success', false,
    'remaining', v_sub_balance + sync_credit_balance_from_lots(p_user_id)
  );
END;
$$;

-- ── 8. unlock_credit_feature_once 재작성 ───────────────────────────────
-- 멱등 해금도 동일하게 subscription_balance → 비만료 lot 순서로 차감해야 한다.
-- (이 함수가 balance 를 직접 깎으면 lot 합과 어긋나므로 lot 경로로 통일.)
CREATE OR REPLACE FUNCTION unlock_credit_feature_once(
  p_user_id UUID,
  p_feature TEXT,
  p_cost INT,
  p_access_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub_balance INT;
  v_balance INT;
  v_existing_id UUID;
  v_access_metadata JSONB;
  v_consumed BOOLEAN;
BEGIN
  IF p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reused', false, 'remaining', 0, 'error', '잘못된 코인 비용입니다.');
  END IF;

  v_access_metadata := COALESCE(p_access_metadata, '{}'::jsonb);

  IF NOT (v_access_metadata ? 'kind') THEN
    RETURN jsonb_build_object('success', false, 'reused', false, 'remaining', 0, 'error', '해금 기준 정보가 필요합니다.');
  END IF;

  INSERT INTO public.user_credits (user_id, balance, subscription_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT subscription_balance, balance
  INTO v_sub_balance, v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_sub_balance := COALESCE(v_sub_balance, 0);

  -- 이미 같은 기준으로 해금된 적이 있으면 재차감 없이 재사용.
  SELECT id
  INTO v_existing_id
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND type = 'use'
    AND feature = p_feature
    AND metadata @> v_access_metadata
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'reused', true,
      'remaining', v_sub_balance + sync_credit_balance_from_lots(p_user_id)
    );
  END IF;

  -- 1) 구독 크레딧 먼저.
  IF v_sub_balance >= p_cost THEN
    UPDATE public.user_credits
    SET subscription_balance = subscription_balance - p_cost,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions (user_id, amount, type, feature, metadata)
    VALUES (
      p_user_id,
      -p_cost,
      'use',
      p_feature,
      v_access_metadata || jsonb_build_object('charged', true, 'cost', p_cost, 'unlockMode', 'idempotent')
    );

    RETURN jsonb_build_object(
      'success', true,
      'reused', false,
      'remaining', (v_sub_balance - p_cost) + sync_credit_balance_from_lots(p_user_id)
    );
  END IF;

  -- 2) 비만료 lot FIFO.
  v_consumed := consume_credit_lots(p_user_id, p_cost);

  IF v_consumed THEN
    INSERT INTO public.credit_transactions (user_id, amount, type, feature, metadata)
    VALUES (
      p_user_id,
      -p_cost,
      'use',
      p_feature,
      v_access_metadata || jsonb_build_object('charged', true, 'cost', p_cost, 'unlockMode', 'idempotent')
    );

    SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'success', true,
      'reused', false,
      'remaining', COALESCE(v_balance, 0)
    );
  END IF;

  -- 3) 둘 다 부족.
  RETURN jsonb_build_object(
    'success', false,
    'reused', false,
    'remaining', v_sub_balance + sync_credit_balance_from_lots(p_user_id),
    'error', '코인이 부족합니다.'
  );
END;
$$;

-- ── 9. handle_new_user 재작성 — 가입 보너스도 lot 으로 적립 ─────────────
-- 중요: 이제 balance 는 비만료 lot 합으로 계산/차감되므로, 가입 보너스 3코인을
--   user_credits.balance 에 직접 넣으면(기존 017 방식) 차감 불가·표시 0 이 된다.
--   → 보너스도 add_credit_lot 으로 적립해 spendable/visible 하게 만든다.
--   (기존 가입자는 §2 grandfather 백필이 balance 전액=보너스 포함 lot 으로 이미 커버.)
-- 만료: 보너스도 1년(결제 코인과 동일). best-effort/non-blocking(017 동작 보존) —
--   트리거 예외가 소셜 로그인 가입을 막지 않도록 EXCEPTION 으로 흡수한다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 보너스 3코인을 1년 만료 lot 으로 적립(add_credit_lot 이 user_credits 행 생성·balance 동기화).
  PERFORM add_credit_lot(
    NEW.id,
    3,
    now() + interval '1 year',
    'signup_bonus',
    jsonb_build_object('kind', 'signup_bonus', 'source', 'auth_user_created')
  );

  INSERT INTO public.credit_transactions (user_id, amount, type, feature, metadata)
  VALUES (
    NEW.id,
    3,
    'signup_bonus',
    'signup_bonus',
    jsonb_build_object('kind', 'signup_bonus', 'source', 'auth_user_created')
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user skipped for user %, SQLSTATE %, error %', NEW.id, SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$;
