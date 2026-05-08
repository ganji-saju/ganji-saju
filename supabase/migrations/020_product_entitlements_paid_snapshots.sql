-- 모든 유료 해금의 기준을 product_entitlements로 통합하고,
-- 결제 당시 결과를 보관할 스냅샷 테이블을 추가한다.

ALTER TABLE public.product_entitlements
  DROP CONSTRAINT IF EXISTS product_entitlements_product_id_check;

ALTER TABLE public.product_entitlements
  ADD CONSTRAINT product_entitlements_product_id_check CHECK (
    product_id IN (
      'today-detail',
      'monthly-calendar',
      'love-question',
      'money-pattern',
      'work-flow',
      'year-core',
      'lifetime-report'
    )
  );

CREATE TABLE IF NOT EXISTS public.paid_reading_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID REFERENCES public.product_entitlements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  scope_key TEXT NOT NULL DEFAULT 'global',
  reading_id UUID REFERENCES public.readings(id) ON DELETE SET NULL,
  reading_key TEXT,
  source_slug TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  snapshot_version TEXT NOT NULL DEFAULT 'paid-reading-snapshot/v1',
  occurred_on DATE,
  target_year INT,
  target_month INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.paid_reading_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "본인 유료 풀이 스냅샷 조회" ON public.paid_reading_snapshots;
CREATE POLICY "본인 유료 풀이 스냅샷 조회" ON public.paid_reading_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_reading_snapshots_user_product_scope
  ON public.paid_reading_snapshots (user_id, product_id, scope_key);

CREATE INDEX IF NOT EXISTS idx_paid_reading_snapshots_user_created
  ON public.paid_reading_snapshots (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_paid_reading_snapshots_reading
  ON public.paid_reading_snapshots (reading_id);

INSERT INTO public.product_entitlements (
  user_id,
  product_id,
  scope_key,
  order_id,
  payment_key,
  package_id,
  amount,
  metadata,
  created_at
)
SELECT
  user_id,
  'lifetime-report',
  'lifetime:' || (metadata->>'readingKey'),
  NULLIF(metadata->>'orderId', ''),
  NULLIF(metadata->>'paymentKey', ''),
  'lifetime_report',
  CASE
    WHEN jsonb_typeof(metadata->'amount') = 'number' THEN (metadata->>'amount')::INT
    ELSE amount
  END,
  metadata || jsonb_build_object(
    'kind', 'lifetime_report',
    'productId', 'lifetime-report',
    'scopeKey', 'lifetime:' || (metadata->>'readingKey'),
    'backfilledFrom', 'credit_transactions'
  ),
  created_at
FROM public.credit_transactions
WHERE type = 'purchase'
  AND feature = 'lifetime_report'
  AND metadata->>'kind' = 'lifetime_report'
  AND NULLIF(metadata->>'readingKey', '') IS NOT NULL
ON CONFLICT (user_id, product_id, scope_key) DO UPDATE SET
  order_id = COALESCE(public.product_entitlements.order_id, EXCLUDED.order_id),
  payment_key = COALESCE(public.product_entitlements.payment_key, EXCLUDED.payment_key),
  package_id = COALESCE(public.product_entitlements.package_id, EXCLUDED.package_id),
  amount = COALESCE(public.product_entitlements.amount, EXCLUDED.amount),
  metadata = public.product_entitlements.metadata || EXCLUDED.metadata;
