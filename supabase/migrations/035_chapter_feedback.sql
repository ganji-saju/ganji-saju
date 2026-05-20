-- 2026-05-20 V2-5 PR R — 챕터별 사용자 피드백 루프 (옵션 A: 별점 + Yes/No).
--
-- 검증 6 후속 — 진단서 6단계 후 "사용자 피드백 루프 셋업" 항목.
-- 9 챕터 LLM 풀이의 *체감 정확도* 와 *유용성* 을 수집해 LLM 품질 개선 사이클의
-- 입력으로 사용. 추가적으로 ORM (Online Reputation Management) 측면에서 부정 응답
-- 비율이 높은 챕터를 빠르게 식별 가능.
--
-- 스키마:
--   - user_id: auth.users 참조 (계정 삭제 시 NULL — 익명 통계 잔존).
--   - reading_id: 사주 풀이 식별자 (UUID 또는 slug 호환 TEXT).
--   - chapter_id: 1~9 (8장은 daewoon-llm-spec 위임, 별도 처리).
--   - rating: 1~5 별점 (NULL 가능 — helpful 만 응답한 경우).
--   - helpful_bool: 이 풀이 도움됐어요? Yes(true)/No(false)/미응답(null).
--   - comment: 선택 자유 코멘트 (옵션 A 미사용, future-compatibility 위해 nullable).
--   - UNIQUE (user_id, reading_id, chapter_id) → upsert 패턴 (한 사용자 한 풀이당 1회).

CREATE TABLE IF NOT EXISTS chapter_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  reading_id TEXT NOT NULL,
  chapter_id INTEGER NOT NULL CHECK (chapter_id BETWEEN 1 AND 9),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  helpful_bool BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chapter_feedback_unique_per_user_reading_chapter
    UNIQUE (user_id, reading_id, chapter_id),
  -- 모든 응답이 NULL 인 row 는 의미 없음 — rating 또는 helpful_bool 중 하나는 필수.
  CONSTRAINT chapter_feedback_has_response
    CHECK (rating IS NOT NULL OR helpful_bool IS NOT NULL)
);

-- 사용자별 최근 피드백 조회 (대시보드/마이페이지).
CREATE INDEX IF NOT EXISTS idx_chapter_feedback_user_recent
  ON chapter_feedback (user_id, created_at DESC);

-- 챕터별 집계 (LLM 품질 모니터링 대시보드 — 별도 PR).
CREATE INDEX IF NOT EXISTS idx_chapter_feedback_chapter_created
  ON chapter_feedback (chapter_id, created_at DESC);

-- 특정 풀이의 피드백 조회 (UNIQUE 가 자동 인덱스).

-- Trigger: updated_at 자동 갱신.
CREATE OR REPLACE FUNCTION update_chapter_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chapter_feedback_set_updated_at ON chapter_feedback;
CREATE TRIGGER chapter_feedback_set_updated_at
  BEFORE UPDATE ON chapter_feedback
  FOR EACH ROW EXECUTE FUNCTION update_chapter_feedback_updated_at();

-- RLS — 사용자는 본인 피드백만 SELECT/INSERT/UPDATE. admin (service_role) 은 모두 접근.
ALTER TABLE chapter_feedback ENABLE ROW LEVEL SECURITY;

-- 2026-05-20 idempotent fix — Postgres CREATE POLICY 는 IF NOT EXISTS 미지원.
--   부분 적용 후 재실행 시 42710 (duplicate policy) 오류 회피 위해 DROP 선행.
DROP POLICY IF EXISTS "Users can read own chapter feedback" ON chapter_feedback;
CREATE POLICY "Users can read own chapter feedback"
  ON chapter_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chapter feedback" ON chapter_feedback;
CREATE POLICY "Users can insert own chapter feedback"
  ON chapter_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chapter feedback" ON chapter_feedback;
CREATE POLICY "Users can update own chapter feedback"
  ON chapter_feedback
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 익명 사용자 (user_id NULL) 통계 집계용 PUBLIC SELECT 는 service_role 만 허용.
-- (RLS 정책 없음 → service_role 외 SELECT 불가).
