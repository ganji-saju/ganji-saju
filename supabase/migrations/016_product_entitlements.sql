-- 소액 상품 이용권은 거래 이력과 분리해 "현재 보유 권한"으로 관리합니다.
-- scope_key는 전역 상품도 unique 제약이 정확히 걸리도록 'global'을 기본값으로 둡니다.
CREATE TABLE IF NOT EXISTS public.product_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  product_id TEXT NOT NULL CHECK (
    product_id IN ('today-detail', 'monthly-calendar', 'love-question', 'money-pattern', 'work-flow', 'year-core')
  ),
  scope_key TEXT NOT NULL DEFAULT 'global',
  order_id TEXT,
  payment_key TEXT,
  package_id TEXT,
  amount INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "본인 소액 상품 권한 조회" ON public.product_entitlements;
CREATE POLICY "본인 소액 상품 권한 조회" ON public.product_entitlements
  FOR SELECT USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_entitlements_user_product_scope
  ON public.product_entitlements (user_id, product_id, scope_key);

CREATE INDEX IF NOT EXISTS idx_product_entitlements_user_created
  ON public.product_entitlements (user_id, created_at DESC);

-- 기존 credit_transactions.metadata에 남긴 taste_product 권한을 새 권한 테이블로 이관합니다.
INSERT INTO public.product_entitlements (
  user_id,
  product_id,
  scope_key,
  order_id,
  payment_key,
  package_id,
  amount,
  metadata,
  created_at,
  updated_at
)
SELECT
  user_id,
  metadata->>'productId' AS product_id,
  COALESCE(NULLIF(metadata->>'scopeKey', ''), 'global') AS scope_key,
  NULLIF(metadata->>'orderId', '') AS order_id,
  NULLIF(metadata->>'paymentKey', '') AS payment_key,
  NULLIF(metadata->>'packageId', '') AS package_id,
  CASE
    WHEN jsonb_typeof(metadata->'amount') = 'number' THEN (metadata->>'amount')::INT
    ELSE amount
  END AS amount,
  metadata,
  created_at,
  created_at
FROM public.credit_transactions
WHERE type = 'purchase'
  AND feature = 'taste_product'
  AND metadata->>'kind' = 'taste_product'
  AND metadata->>'productId' IN ('today-detail', 'monthly-calendar', 'love-question', 'money-pattern', 'work-flow', 'year-core')
ON CONFLICT (user_id, product_id, scope_key) DO UPDATE
SET
  order_id = COALESCE(public.product_entitlements.order_id, EXCLUDED.order_id),
  payment_key = COALESCE(public.product_entitlements.payment_key, EXCLUDED.payment_key),
  package_id = COALESCE(public.product_entitlements.package_id, EXCLUDED.package_id),
  amount = COALESCE(public.product_entitlements.amount, EXCLUDED.amount),
  metadata = public.product_entitlements.metadata || EXCLUDED.metadata,
  updated_at = now();
