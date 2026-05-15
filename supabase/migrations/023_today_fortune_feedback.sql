-- 2026-05-15 PR 9 — 03_사용자피드백_ML_가중치학습.md §3-2 적용.
-- 사용자가 오늘의 운세에 대해 "정확/보통/안맞음" 피드백을 남길 수 있는 테이블.
-- 향후 ML 가중치 학습 (XGBoost / Ridge / Online SGD) 의 데이터 소스가 됨.

CREATE TABLE IF NOT EXISTS today_fortune_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_session_id TEXT NOT NULL,
  fortune_date DATE NOT NULL,

  -- 시스템이 예측한 점수 (피드백 시점의 snapshot)
  predicted_total_score SMALLINT NOT NULL,
  predicted_breakdown JSONB,

  -- 사용자 피드백 — 운세톡톡 벤치마크 3단계: -1 / 0 / +1
  overall_rating SMALLINT NOT NULL CHECK (overall_rating IN (-1, 0, 1)),

  -- 영역별 정확도 (선택) — 1~5 별점
  wealth_rating SMALLINT CHECK (wealth_rating BETWEEN 1 AND 5),
  love_rating SMALLINT CHECK (love_rating BETWEEN 1 AND 5),
  career_rating SMALLINT CHECK (career_rating BETWEEN 1 AND 5),
  health_rating SMALLINT CHECK (health_rating BETWEEN 1 AND 5),
  relationship_rating SMALLINT CHECK (relationship_rating BETWEEN 1 AND 5),

  -- 자유 코멘트
  user_comment TEXT,

  -- 피드백 시점 메타
  time_to_feedback_seconds INT, -- 결과 페이지 진입 ~ 피드백 클릭까지 (노이즈 필터링용)

  -- ML 학습 피쳐 스냅샷 — 추후 가중치 학습 시 사용
  feature_snapshot JSONB,
  triggered_cases JSONB,
  detected_sinsals JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 user + 같은 날 1회만.
  UNIQUE (user_id, fortune_date)
);

-- 자주 쓰는 조회 — 사용자별 최근 피드백 / 날짜 범위 / 점수 분포 / 정확도 통계.
CREATE INDEX IF NOT EXISTS today_fortune_feedback_user_date_idx
  ON today_fortune_feedback (user_id, fortune_date DESC);

CREATE INDEX IF NOT EXISTS today_fortune_feedback_created_at_idx
  ON today_fortune_feedback (created_at DESC);

-- RLS — 본인 데이터만 조회/입력 가능.
ALTER TABLE today_fortune_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY today_fortune_feedback_select_own
  ON today_fortune_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY today_fortune_feedback_insert_own
  ON today_fortune_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY today_fortune_feedback_update_own
  ON today_fortune_feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
