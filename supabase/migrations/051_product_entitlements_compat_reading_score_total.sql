-- 2026-06-07 — product_entitlements.product_id CHECK 제약 드리프트 정리.
--   누락 product_id 2개를 허용 목록에 추가한다:
--     * 'compat-reading' (per-couple 궁합 1회권, 코드 #345 2026-05-23 도입 — 038 제약 다음날이라 누락)
--     * 'score-total'    (종합점수 단일 언락, 코드 #428 도입 — 이후 누락)
--
-- 배경(실측): 제약에 없는 product_id 로 grantTasteProductEntitlement 가 INSERT 하면
--   23514(check 위반)로 거부되고, grantTasteProductEntitlement 가 이를 catch 해
--   grantLegacyTasteProductEntitlement(credit_transactions) 로 폴백한다. 따라서 접근은
--   유지되지만(getTasteProductEntitlement 가 legacy 도 scope 매칭으로 읽음) 이용권이
--   정식 테이블이 아니라 credit_transactions 에만 남는 드리프트가 발생했다.
--   prod 확인: compat-reading/score-total product_entitlements 행 0건, 동일 결제가
--   credit_transactions(type=purchase, feature=taste_product, metadata.scopeKey=compat:{key})
--   로만 적재됨. 이 마이그레이션으로 신규 결제분은 정식 테이블에 적재된다.
--
-- NOT VALID 사용 이유(038 과 동일): prod product_entitlements 에 현재 카탈로그에 없는
--   레거시 product_id 가 섞여 있어(드리프트) 전체 검증형 CHECK 재생성은 23514 로 실패한다.
--   NOT VALID 는 신규 INSERT/UPDATE 에만 제약을 강제하고 기존 행은 재검증하지 않아 안전하다.
--
-- 멱등: DROP CONSTRAINT IF EXISTS + ADD.
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
      'score-factor',
      'compat-reading',
      'score-total'
    )
  ) NOT VALID;
