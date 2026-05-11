-- 성향궁합 결과 재조회와 중복 저장 방지를 위한 결과 범위 키.
ALTER TABLE public.compatibility_personality_reports
  ADD COLUMN IF NOT EXISTS scope_key TEXT;

COMMENT ON COLUMN public.compatibility_personality_reports.scope_key IS
  '성향궁합 입력 조합에서 만든 비식별 결과 범위 키. 공유 카드에는 원본 생년월일시를 노출하지 않는다.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_compatibility_personality_reports_user_scope
  ON public.compatibility_personality_reports (user_id, scope_key);
