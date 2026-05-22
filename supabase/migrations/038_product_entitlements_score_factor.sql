-- 2026-05-22 — per-factor 점수 풀이(score-factor) 상품 추가.
--   product_entitlements.product_id CHECK 제약에 'score-factor' 를 허용한다.
--   (없으면 grantTasteProductEntitlement('score-factor', ...) 가 23514 로 거부됨.)
--
-- NOT VALID 사용 이유:
--   prod product_entitlements 에 현재 카탈로그(아래 목록)에 없는 레거시 product_id 가
--   섞여 있어(스키마 드리프트) 전체 검증형 CHECK 재생성 시 23514 로 마이그레이션이 실패했다.
--   NOT VALID 는 신규 INSERT/UPDATE 에는 제약을 강제(=score-factor 허용, 오타 차단)하되
--   기존 행은 재검증하지 않아, 레거시 행을 깨거나 데이터 삭제 없이 안전하게 적용된다.
--   (드리프트 레거시 값 확인용: SELECT product_id, count(*) FROM public.product_entitlements GROUP BY 1;)
--
-- 멱등: DROP CONSTRAINT IF EXISTS + ADD. (이전 038 시도에서 DROP 만 성공해 제약이 사라진 상태도 복구.)
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
  ) NOT VALID;
