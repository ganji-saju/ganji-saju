-- 달빛 성향궁합 MVP 저장 구조.
-- 기존 profiles는 user_id가 PK이고, family_profiles는 id가 PK라서
-- personality_profiles.profile_id는 저장된 상대/가족 프로필(family_profiles.id)에만 FK로 연결한다.
-- profile_id가 NULL이면 본인 프로필 또는 비저장/수동 입력 참여자를 의미하며,
-- 실제 입력 스냅샷은 compatibility_personality_reports.*_facts_json에 남긴다.

CREATE TABLE IF NOT EXISTS public.personality_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  profile_id UUID REFERENCES public.family_profiles(id) ON DELETE SET NULL,
  type_code TEXT NOT NULL CHECK (
    type_code IN (
      'ISTJ',
      'ISFJ',
      'INFJ',
      'INTJ',
      'ISTP',
      'ISFP',
      'INFP',
      'INTP',
      'ESTP',
      'ESFP',
      'ENFP',
      'ENTP',
      'ESTJ',
      'ESFJ',
      'ENFJ',
      'ENTJ'
    )
  ),
  source TEXT NOT NULL CHECK (source IN ('self_reported', 'moonlight_check')),
  confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compatibility_personality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  profile_a_id UUID REFERENCES public.personality_profiles(id) ON DELETE SET NULL,
  profile_b_id UUID REFERENCES public.personality_profiles(id) ON DELETE SET NULL,
  relationship_type TEXT NOT NULL CHECK (char_length(trim(relationship_type)) > 0),
  question_type TEXT NOT NULL DEFAULT 'general' CHECK (char_length(trim(question_type)) > 0),
  score_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(score_json) = 'object'),
  saju_facts_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(saju_facts_json) = 'object'),
  personality_facts_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(personality_facts_json) = 'object'),
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(report_json) = 'object'),
  product_code TEXT NOT NULL DEFAULT 'free',
  paid_amount INT CHECK (paid_amount IS NULL OR paid_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.compatibility_personality_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags_json) = 'array'),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personality_profiles IS
  '달빛 성향궁합의 16유형 성향 저장 테이블. 공식 검사/진단 결과가 아니라 사용자 선택 또는 달빛 체크 결과를 저장한다.';
COMMENT ON COLUMN public.personality_profiles.profile_id IS
  '저장된 상대/가족 프로필이면 family_profiles.id. NULL이면 본인 프로필 또는 비저장/수동 입력 참여자.';
COMMENT ON COLUMN public.personality_profiles.type_code IS
  '사용자 선택 또는 8문항 달빛 체크 결과. 의학적·심리학적 진단 결과가 아니다.';
COMMENT ON COLUMN public.personality_profiles.answers_json IS
  '8문항 달빛 체크 답변과 요약 메타데이터. 불필요한 민감 자유서술은 저장하지 않는다.';
COMMENT ON TABLE public.compatibility_personality_reports IS
  '사주 궁합 facts와 16유형 성향 facts를 함께 저장하는 성향궁합 리포트 테이블.';
COMMENT ON COLUMN public.compatibility_personality_reports.saju_facts_json IS
  '기존 사주 엔진에서 나온 궁합 판단용 facts. 원문 프롬프트는 저장하지 않는다.';
COMMENT ON COLUMN public.compatibility_personality_reports.personality_facts_json IS
  '16유형 성향 선택/체크 결과와 관계 축 해석에 필요한 facts.';
COMMENT ON COLUMN public.compatibility_personality_reports.report_json IS
  '무료/유료 결과 화면 재열람을 위한 안정적인 리포트 스냅샷.';
COMMENT ON TABLE public.report_feedback IS
  '성향궁합 리포트에 대한 사용자 피드백 테이블.';
COMMENT ON COLUMN public.report_feedback.tags_json IS
  '피드백 태그 배열. 민감한 자유서술 정보는 저장하지 않는다.';

CREATE INDEX IF NOT EXISTS idx_personality_profiles_user_created
  ON public.personality_profiles (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_personality_profiles_user_profile
  ON public.personality_profiles (user_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_compatibility_personality_reports_user_created
  ON public.compatibility_personality_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compatibility_personality_reports_profiles
  ON public.compatibility_personality_reports (profile_a_id, profile_b_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_feedback_user_report
  ON public.report_feedback (user_id, report_id);

CREATE INDEX IF NOT EXISTS idx_report_feedback_report_created
  ON public.report_feedback (report_id, created_at DESC);

ALTER TABLE public.personality_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compatibility_personality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "본인 성향 프로필 조회" ON public.personality_profiles;
CREATE POLICY "본인 성향 프로필 조회" ON public.personality_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "본인 성향 프로필 추가" ON public.personality_profiles;
CREATE POLICY "본인 성향 프로필 추가" ON public.personality_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.family_profiles
        WHERE family_profiles.id = personality_profiles.profile_id
          AND family_profiles.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "본인 성향 프로필 수정" ON public.personality_profiles;
CREATE POLICY "본인 성향 프로필 수정" ON public.personality_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.family_profiles
        WHERE family_profiles.id = personality_profiles.profile_id
          AND family_profiles.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "본인 성향 프로필 삭제" ON public.personality_profiles;
CREATE POLICY "본인 성향 프로필 삭제" ON public.personality_profiles
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "본인 성향궁합 리포트 조회" ON public.compatibility_personality_reports;
CREATE POLICY "본인 성향궁합 리포트 조회" ON public.compatibility_personality_reports
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "본인 성향궁합 리포트 추가" ON public.compatibility_personality_reports;
CREATE POLICY "본인 성향궁합 리포트 추가" ON public.compatibility_personality_reports
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      profile_a_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.personality_profiles
        WHERE personality_profiles.id = compatibility_personality_reports.profile_a_id
          AND personality_profiles.user_id = auth.uid()
      )
    )
    AND (
      profile_b_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.personality_profiles
        WHERE personality_profiles.id = compatibility_personality_reports.profile_b_id
          AND personality_profiles.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "본인 성향궁합 리포트 수정" ON public.compatibility_personality_reports;
CREATE POLICY "본인 성향궁합 리포트 수정" ON public.compatibility_personality_reports
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      profile_a_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.personality_profiles
        WHERE personality_profiles.id = compatibility_personality_reports.profile_a_id
          AND personality_profiles.user_id = auth.uid()
      )
    )
    AND (
      profile_b_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.personality_profiles
        WHERE personality_profiles.id = compatibility_personality_reports.profile_b_id
          AND personality_profiles.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "본인 성향궁합 리포트 삭제" ON public.compatibility_personality_reports;
CREATE POLICY "본인 성향궁합 리포트 삭제" ON public.compatibility_personality_reports
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "본인 리포트 피드백 조회" ON public.report_feedback;
CREATE POLICY "본인 리포트 피드백 조회" ON public.report_feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "본인 리포트 피드백 추가" ON public.report_feedback;
CREATE POLICY "본인 리포트 피드백 추가" ON public.report_feedback
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.compatibility_personality_reports
      WHERE compatibility_personality_reports.id = report_feedback.report_id
        AND compatibility_personality_reports.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "본인 리포트 피드백 수정" ON public.report_feedback;
CREATE POLICY "본인 리포트 피드백 수정" ON public.report_feedback
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.compatibility_personality_reports
      WHERE compatibility_personality_reports.id = report_feedback.report_id
        AND compatibility_personality_reports.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "본인 리포트 피드백 삭제" ON public.report_feedback;
CREATE POLICY "본인 리포트 피드백 삭제" ON public.report_feedback
  FOR DELETE USING (auth.uid() = user_id);
