-- 달빛 성향궁합 깊이보기 990원 상품을 product_entitlements 권한 기준에 추가한다.
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
      'personality_compatibility_mini'
    )
  );
