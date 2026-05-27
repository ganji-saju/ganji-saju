-- 2026-05-27 — Refund request dedupe hardening.
--
-- Prevent duplicate refund workflow rows for the same entitlement or Toss paymentKey.
-- Retries should reuse the existing failed/revoke_pending request instead of creating
-- a second request that makes Toss return "already canceled".

WITH ranked_by_entitlement AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY entitlement_id
      ORDER BY
        CASE status
          WHEN 'completed' THEN 1
          WHEN 'revoke_pending' THEN 2
          WHEN 'processing' THEN 3
          WHEN 'requested' THEN 4
          WHEN 'failed' THEN 5
          ELSE 6
        END,
        created_at ASC
    ) AS rn
  FROM public.refund_requests
  WHERE entitlement_id IS NOT NULL
    AND status IN ('requested', 'processing', 'completed', 'failed', 'revoke_pending')
)
UPDATE public.refund_requests AS rr
SET
  status = 'rejected',
  error_message = concat_ws(
    ' / ',
    NULLIF(rr.error_message, ''),
    '중복 환불 요청으로 정리됨. 같은 entitlement_id의 기존 요청을 사용하세요.'
  ),
  updated_at = now()
FROM ranked_by_entitlement AS ranked
WHERE rr.id = ranked.id
  AND ranked.rn > 1;

WITH ranked_by_payment_key AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY payment_key
      ORDER BY
        CASE status
          WHEN 'completed' THEN 1
          WHEN 'revoke_pending' THEN 2
          WHEN 'processing' THEN 3
          WHEN 'requested' THEN 4
          WHEN 'failed' THEN 5
          ELSE 6
        END,
        created_at ASC
    ) AS rn
  FROM public.refund_requests
  WHERE payment_key IS NOT NULL
    AND status IN ('requested', 'processing', 'completed', 'failed', 'revoke_pending')
)
UPDATE public.refund_requests AS rr
SET
  status = 'rejected',
  error_message = concat_ws(
    ' / ',
    NULLIF(rr.error_message, ''),
    '중복 환불 요청으로 정리됨. 같은 payment_key의 기존 요청을 사용하세요.'
  ),
  updated_at = now()
FROM ranked_by_payment_key AS ranked
WHERE rr.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_active_entitlement_uidx
  ON public.refund_requests (entitlement_id)
  WHERE entitlement_id IS NOT NULL
    AND status IN ('requested', 'processing', 'completed', 'failed', 'revoke_pending');

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_active_payment_key_uidx
  ON public.refund_requests (payment_key)
  WHERE payment_key IS NOT NULL
    AND status IN ('requested', 'processing', 'completed', 'failed', 'revoke_pending');
