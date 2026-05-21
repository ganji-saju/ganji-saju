-- 2026-05-22 — per-factor 점수 풀이(score-factor) 상품 추가.
--   product_entitlements.product_id CHECK 제약을 drop + 전체 목록 + 'score-factor' 로 재생성.
--   (없으면 grantTasteProductEntitlement('score-factor', ...) 가 23514 로 거부됨.)
--   멱등: DROP CONSTRAINT IF EXISTS + ADD.
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
      'lifetime-report',
      'score-factor'
    )
  );
