-- 달빛 성향사주 MVP 리포트 저장 구조.
-- 기존 readings는 개인 사주 chart/report 원본으로 재사용하고,
-- 기존 personality_profiles는 16유형 성향 입력/체크 결과로 재사용한다.
-- compatibility_personality_reports는 2인 관계형 리포트 전용이라 개인 사주 리포트에 재사용하지 않는다.

CREATE TABLE IF NOT EXISTS public.saju_personality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  profile_id UUID REFERENCES public.family_profiles(id) ON DELETE SET NULL,
  saju_chart_id UUID REFERENCES public.readings(id) ON DELETE SET NULL,
  personality_profile_id UUID REFERENCES public.personality_profiles(id) ON DELETE SET NULL,
  scope_key TEXT NOT NULL CHECK (char_length(trim(scope_key)) > 0),
  report_type TEXT NOT NULL DEFAULT 'free' CHECK (report_type IN ('free', 'paid')),
  life_area TEXT NOT NULL DEFAULT 'basic' CHECK (
    life_area IN (
      'basic',
      'love',
      'relationships',
      'work',
      'money_achievement',
      'year',
      'today'
    )
  ),
  score_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(score_json) = 'object'),
  saju_facts_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(saju_facts_json) = 'object'),
  personality_facts_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(personality_facts_json) = 'object'),
  fusion_facts_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(fusion_facts_json) = 'object'),
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(report_json) = 'object'),
  product_code TEXT NOT NULL DEFAULT 'free' CHECK (char_length(trim(product_code)) > 0),
  paid_amount INT CHECK (paid_amount IS NULL OR paid_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (report_type = 'free' OR product_code <> 'free')
);

COMMENT ON TABLE public.saju_personality_reports IS
  '개인 사주 리딩과 16유형 성향 facts를 결합한 달빛 성향사주 리포트 저장 테이블.';
COMMENT ON COLUMN public.saju_personality_reports.profile_id IS
  '저장된 가족/상대 프로필(family_profiles.id)을 기준으로 시작한 경우의 profile id. 본인 기본 프로필 또는 신규 입력이면 NULL.';
COMMENT ON COLUMN public.saju_personality_reports.saju_chart_id IS
  '기존 개인 사주 리딩(readings.id). 사주 계산 결과를 새로 만들지 않고 기존 readings.result_json을 facts 입력으로 사용한다.';
COMMENT ON COLUMN public.saju_personality_reports.personality_profile_id IS
  '기존 personality_profiles.id. 16유형 직접 선택 또는 8문항 달빛 체크 결과를 재사용한다.';
COMMENT ON COLUMN public.saju_personality_reports.scope_key IS
  '리딩, 성향 프로필, 관심영역 조합에서 만든 비식별 결과 범위 키. 원본 생년월일시나 이름을 넣지 않는다.';
COMMENT ON COLUMN public.saju_personality_reports.report_type IS
  'free 또는 paid. 결제 전/후 재조회와 잠금 영역 분리를 위한 리포트 타입.';
COMMENT ON COLUMN public.saju_personality_reports.life_area IS
  'basic, love, relationships, work, money_achievement, year, today 중 하나의 관심영역.';
COMMENT ON COLUMN public.saju_personality_reports.score_json IS
  '6축 성향사주 점수 스냅샷. 모든 점수는 0~100 normalize 값을 사용한다.';
COMMENT ON COLUMN public.saju_personality_reports.saju_facts_json IS
  '기존 사주 엔진 결과에서 추출한 개인 해석용 facts. 원본 개인정보를 중복 저장하지 않는다.';
COMMENT ON COLUMN public.saju_personality_reports.personality_facts_json IS
  '16유형 성향 선택/체크 결과에서 추출한 개인 해석용 facts.';
COMMENT ON COLUMN public.saju_personality_reports.fusion_facts_json IS
  '사주 facts와 성향 facts를 결합해 만든 개인 성향사주 해석 단서.';
COMMENT ON COLUMN public.saju_personality_reports.report_json IS
  '무료/유료 결과 화면 재열람을 위한 안정적인 리포트 스냅샷.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_saju_personality_reports_user_scope
  ON public.saju_personality_reports (user_id, scope_key);

CREATE INDEX IF NOT EXISTS idx_saju_personality_reports_user_created
  ON public.saju_personality_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saju_personality_reports_saju_chart
  ON public.saju_personality_reports (saju_chart_id);

CREATE INDEX IF NOT EXISTS idx_saju_personality_reports_personality_profile
  ON public.saju_personality_reports (personality_profile_id);

CREATE INDEX IF NOT EXISTS idx_saju_personality_reports_life_area
  ON public.saju_personality_reports (user_id, life_area, created_at DESC);

ALTER TABLE public.saju_personality_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 성향사주 리포트 조회" ON public.saju_personality_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 성향사주 리포트 추가" ON public.saju_personality_reports
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.family_profiles
        WHERE family_profiles.id = saju_personality_reports.profile_id
          AND family_profiles.user_id = auth.uid()
      )
    )
    AND (
      saju_chart_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.readings
        WHERE readings.id = saju_personality_reports.saju_chart_id
          AND (readings.user_id = auth.uid() OR readings.user_id IS NULL)
      )
    )
    AND (
      personality_profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.personality_profiles
        WHERE personality_profiles.id = saju_personality_reports.personality_profile_id
          AND personality_profiles.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "본인 성향사주 리포트 수정" ON public.saju_personality_reports
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.family_profiles
        WHERE family_profiles.id = saju_personality_reports.profile_id
          AND family_profiles.user_id = auth.uid()
      )
    )
    AND (
      saju_chart_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.readings
        WHERE readings.id = saju_personality_reports.saju_chart_id
          AND (readings.user_id = auth.uid() OR readings.user_id IS NULL)
      )
    )
    AND (
      personality_profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.personality_profiles
        WHERE personality_profiles.id = saju_personality_reports.personality_profile_id
          AND personality_profiles.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "본인 성향사주 리포트 삭제" ON public.saju_personality_reports
  FOR DELETE USING (auth.uid() = user_id);
