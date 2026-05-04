-- 소액 풀이 상품이 추가되어도 이용권 저장이 막히지 않도록 product_id 제약을 최신 카탈로그와 맞춥니다.
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
      'year-core'
    )
  );
