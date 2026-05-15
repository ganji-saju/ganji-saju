-- 2026-05-15 — 신살 가중치 학습 버전 테이블.
-- ML 학습 파이프라인: today_fortune_feedback 의 (overall_rating, detected_sinsals) 로
-- 릿지 회귀 → 신살별 최적 가중치 산출. 각 학습 결과를 버전으로 보관.
--
-- 운영 코드는 현재 하드코딩된 weight (sinsal-comprehensive.ts 의 scoreHint) 를 사용.
-- 이 테이블은 admin 이 "데이터가 시사하는 가중치" 를 검토하기 위한 분석용.
-- 향후 active=true 버전을 production scoring 에서 읽어오게 확장 가능.

CREATE TABLE IF NOT EXISTS sinsal_weight_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 학습 메타.
  learned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 윈도우 시작/끝 — 어떤 피드백 범위로 학습했는지.
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  sample_size INTEGER NOT NULL,
  -- L2 regularization 강도. 다중공선성 대응.
  lambda DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  -- 결과 지표.
  mse DOUBLE PRECISION NOT NULL,         -- 학습 데이터 MSE
  r_squared DOUBLE PRECISION,             -- 결정계수 (nullable)
  -- 학습된 가중치 — JSONB { "천을귀인": 12.3, "백호살": -9.1, ... }.
  weights JSONB NOT NULL,
  -- 신살별 표본 통계 — { "천을귀인": { triggered: 50, mean: 0.6 }, ... }.
  per_sinsal_stats JSONB,
  -- 상태: draft (아직 검토 안 됨) / active (운영용 — 1개만 유지) / archived.
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  -- 학습 트리거 사용자.
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  -- 자유 메모.
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 활성 버전 빠른 조회.
CREATE INDEX IF NOT EXISTS sinsal_weight_versions_status_idx
  ON sinsal_weight_versions (status, learned_at DESC);

-- 최근 학습 목록.
CREATE INDEX IF NOT EXISTS sinsal_weight_versions_learned_at_idx
  ON sinsal_weight_versions (learned_at DESC);

-- active 는 0~1 개만 — 부분 unique 인덱스.
CREATE UNIQUE INDEX IF NOT EXISTS sinsal_weight_versions_active_unique
  ON sinsal_weight_versions ((1))
  WHERE status = 'active';

-- RLS: admin 만 (지금은 로그인 사용자 모두 — 후속에서 admin role 화이트리스트 추가).
ALTER TABLE sinsal_weight_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sinsal_weight_versions_select_authenticated
  ON sinsal_weight_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY sinsal_weight_versions_insert_authenticated
  ON sinsal_weight_versions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY sinsal_weight_versions_update_owner
  ON sinsal_weight_versions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
