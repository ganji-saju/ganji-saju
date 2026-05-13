-- P0-2 fix (audit 2026-05-13): /api/payments/confirm 의 5개 후처리 호출을
-- 단일 PL/pgSQL 트랜잭션으로 통합한다.
--   1) user_credits 가산 + credit_transactions 기록
--   2) subscriptions UPSERT (멤버십)
--   3) product_entitlements INSERT (taste / lifetime)
--   4) credit_transactions 의 legacy taste_product 미러
--   5) paid_reading_snapshots UPSERT (보관함)
-- 위 5단계가 같은 트랜잭션 안에서 실행되므로 중간 실패 시 전체 ROLLBACK 된다.
--
-- 멱등성: 동일 paymentKey 로 두 번 호출되면 always already_finalized=true 반환,
-- 추가 INSERT 0건. 026 의 add_credits 멱등성 위에 finalize 수준의 가드를 한 번 더 둔다.
--
-- 모든 비즈니스 로직(스코프 키, 스냅샷 JSON 구성, reading_id 매핑 등)은 호출 측 TS
-- 에서 사전 계산해 단일 JSONB 로 전달한다. 본 함수는 atomic 한 INSERT/UPDATE 만 담당.

CREATE OR REPLACE FUNCTION finalize_payment(p_input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_payment_key TEXT;
  v_order_id TEXT;
  v_package_id TEXT;
  v_package_kind TEXT;
  v_amount INT;
  v_credits INT;
  v_subscription_plan TEXT;
  v_subscription_renew_days INT;
  v_product_id TEXT;
  v_scope_key TEXT;
  v_source_slug TEXT;
  v_reading_id UUID;
  v_reading_key TEXT;
  v_snapshot_json JSONB;
  v_snapshot_title TEXT;
  v_snapshot_summary TEXT;
  v_snapshot_occurred_on DATE;
  v_snapshot_target_year INT;
  v_snapshot_target_month INT;

  v_already_finalized BOOLEAN := FALSE;
  v_balance INT;
  v_sub_balance INT;
  v_entitlement_id UUID;
  v_subscription_renews_at TIMESTAMPTZ;
BEGIN
  -- ─── unpack ─────────────────────────────────────────────────────────
  v_user_id                := (p_input->>'userId')::UUID;
  v_payment_key            := NULLIF(p_input->>'paymentKey', '');
  v_order_id               := NULLIF(p_input->>'orderId', '');
  v_package_id             := NULLIF(p_input->>'packageId', '');
  v_package_kind           := NULLIF(p_input->>'packageKind', '');
  v_amount                 := COALESCE(NULLIF(p_input->>'amount','')::INT, 0);
  v_credits                := COALESCE(NULLIF(p_input->>'credits','')::INT, 0);
  v_subscription_plan      := NULLIF(p_input->>'subscriptionPlan', '');
  v_subscription_renew_days:= COALESCE(NULLIF(p_input->>'subscriptionRenewDays','')::INT, 30);
  v_product_id             := NULLIF(p_input->>'productId', '');        -- 'today-detail' | 'love-question' | ... | 'lifetime-report'
  v_scope_key              := NULLIF(p_input->>'scopeKey', '');         -- pre-computed by TS, 항상 정확한 값
  v_source_slug            := NULLIF(p_input->>'sourceSlug', '');
  v_reading_id             := NULLIF(p_input->>'readingId', '')::UUID;
  v_reading_key            := NULLIF(p_input->>'readingKey', '');
  v_snapshot_json          := p_input->'snapshotJson';
  v_snapshot_title         := NULLIF(p_input->>'snapshotTitle', '');
  v_snapshot_summary       := NULLIF(p_input->>'snapshotSummary', '');
  v_snapshot_occurred_on   := NULLIF(p_input->>'snapshotOccurredOn', '')::DATE;
  v_snapshot_target_year   := NULLIF(p_input->>'snapshotTargetYear','')::INT;
  v_snapshot_target_month  := NULLIF(p_input->>'snapshotTargetMonth','')::INT;

  IF v_user_id IS NULL OR v_payment_key IS NULL OR v_package_id IS NULL THEN
    RAISE EXCEPTION 'finalize_payment requires userId, paymentKey, packageId';
  END IF;

  -- ─── top-level idempotency ──────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = v_user_id
      AND metadata->>'paymentKey' = v_payment_key
    LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM product_entitlements
    WHERE user_id = v_user_id
      AND payment_key = v_payment_key
    LIMIT 1
  ) THEN
    v_already_finalized := TRUE;
  END IF;

  IF NOT v_already_finalized THEN
    -- ─── 1) Credits (credit_pack / subscription bonus pack) ──────────
    IF v_credits > 0 THEN
      INSERT INTO user_credits (user_id, balance, subscription_balance)
      VALUES (v_user_id, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;

      IF v_package_kind = 'subscription' THEN
        UPDATE user_credits
        SET subscription_balance = subscription_balance + v_credits,
            updated_at = now()
        WHERE user_id = v_user_id;
      ELSE
        UPDATE user_credits
        SET balance = balance + v_credits,
            updated_at = now()
        WHERE user_id = v_user_id;
      END IF;

      INSERT INTO credit_transactions (user_id, amount, type, metadata)
      VALUES (
        v_user_id,
        v_credits,
        CASE WHEN v_package_kind = 'subscription' THEN 'subscription' ELSE 'purchase' END,
        jsonb_build_object(
          'orderId', v_order_id,
          'packageId', v_package_id,
          'paymentKey', v_payment_key
        )
      );
    END IF;

    -- ─── 2) Membership subscription 활성화 ────────────────────────────
    IF v_subscription_plan IS NOT NULL THEN
      INSERT INTO subscriptions (user_id, status, plan, renews_at, updated_at)
      VALUES (
        v_user_id,
        'active',
        v_subscription_plan,
        now() + make_interval(days => v_subscription_renew_days),
        now()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET status = 'active',
          plan = EXCLUDED.plan,
          renews_at = CASE
            WHEN subscriptions.renews_at IS NULL OR subscriptions.renews_at < now()
              THEN now() + make_interval(days => v_subscription_renew_days)
            ELSE subscriptions.renews_at + make_interval(days => v_subscription_renew_days)
          END,
          updated_at = now();
    END IF;

    -- ─── 3) Product entitlement (taste / lifetime) ───────────────────
    IF v_product_id IS NOT NULL THEN
      INSERT INTO product_entitlements (
        user_id, product_id, scope_key,
        order_id, payment_key, package_id, amount,
        metadata
      )
      VALUES (
        v_user_id,
        v_product_id,
        COALESCE(v_scope_key, 'global'),
        v_order_id,
        v_payment_key,
        v_package_id,
        v_amount,
        jsonb_build_object(
          'kind', CASE WHEN v_product_id = 'lifetime-report' THEN 'lifetime_report' ELSE 'taste_product' END,
          'productId', v_product_id,
          'scopeKey', COALESCE(v_scope_key, 'global'),
          'readingKey', v_reading_key,
          'orderId', v_order_id,
          'paymentKey', v_payment_key,
          'amount', v_amount,
          'packageId', v_package_id
        )
      )
      ON CONFLICT (user_id, product_id, scope_key) DO NOTHING
      RETURNING id INTO v_entitlement_id;

      -- ─── 4) Legacy mirror in credit_transactions (taste_product 만) ─
      -- grantTasteProductEntitlement 의 두 번째 INSERT 미러 — UI 일부가 여전히 참조.
      IF v_entitlement_id IS NOT NULL AND v_product_id <> 'lifetime-report' THEN
        INSERT INTO credit_transactions (user_id, amount, type, feature, metadata)
        VALUES (
          v_user_id,
          0,
          'purchase',
          'taste_product',
          jsonb_build_object(
            'kind', 'taste_product',
            'productId', v_product_id,
            'scopeKey', v_scope_key,
            'orderId', v_order_id,
            'paymentKey', v_payment_key,
            'amount', v_amount,
            'packageId', v_package_id
          )
        );
      END IF;

      -- ─── 5) Paid reading snapshot (보관함 entry) ──────────────────
      -- entitlement 가 새로 생성됐거나 이미 있던 경우 모두 snapshot 은 UPSERT
      IF v_snapshot_title IS NOT NULL THEN
        -- existing entitlement 이라면 그 id 도 사용
        IF v_entitlement_id IS NULL THEN
          SELECT id INTO v_entitlement_id
          FROM product_entitlements
          WHERE user_id = v_user_id
            AND product_id = v_product_id
            AND scope_key = COALESCE(v_scope_key, 'global')
          LIMIT 1;
        END IF;

        INSERT INTO paid_reading_snapshots (
          entitlement_id, user_id, product_id, scope_key,
          reading_id, reading_key, source_slug,
          title, summary, snapshot_json,
          occurred_on, target_year, target_month,
          updated_at
        )
        VALUES (
          v_entitlement_id,
          v_user_id,
          v_product_id,
          COALESCE(v_scope_key, 'global'),
          v_reading_id,
          v_reading_key,
          v_source_slug,
          v_snapshot_title,
          v_snapshot_summary,
          COALESCE(v_snapshot_json, '{}'::JSONB),
          v_snapshot_occurred_on,
          v_snapshot_target_year,
          v_snapshot_target_month,
          now()
        )
        ON CONFLICT (user_id, product_id, scope_key) DO UPDATE
        SET entitlement_id = COALESCE(EXCLUDED.entitlement_id, paid_reading_snapshots.entitlement_id),
            reading_id = COALESCE(EXCLUDED.reading_id, paid_reading_snapshots.reading_id),
            reading_key = COALESCE(EXCLUDED.reading_key, paid_reading_snapshots.reading_key),
            source_slug = COALESCE(EXCLUDED.source_slug, paid_reading_snapshots.source_slug),
            summary = COALESCE(EXCLUDED.summary, paid_reading_snapshots.summary),
            snapshot_json = paid_reading_snapshots.snapshot_json || EXCLUDED.snapshot_json,
            occurred_on = COALESCE(EXCLUDED.occurred_on, paid_reading_snapshots.occurred_on),
            target_year = COALESCE(EXCLUDED.target_year, paid_reading_snapshots.target_year),
            target_month = COALESCE(EXCLUDED.target_month, paid_reading_snapshots.target_month),
            updated_at = now();
      END IF;
    END IF;
  END IF;

  -- 최종 상태 조회
  SELECT balance, subscription_balance
  INTO v_balance, v_sub_balance
  FROM user_credits WHERE user_id = v_user_id;

  SELECT renews_at
  INTO v_subscription_renews_at
  FROM subscriptions WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'already_finalized', v_already_finalized,
    'total_credits', COALESCE(v_balance, 0) + COALESCE(v_sub_balance, 0),
    'balance', COALESCE(v_balance, 0),
    'subscription_balance', COALESCE(v_sub_balance, 0),
    'subscription_renews_at', v_subscription_renews_at
  );
END;
$$;

COMMENT ON FUNCTION finalize_payment(JSONB) IS
'/api/payments/confirm 의 5개 후처리를 단일 트랜잭션으로 수행 + paymentKey 멱등.';
