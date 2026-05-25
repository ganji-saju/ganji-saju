-- 2026-05-25 Phase 0a — 대운 본편(lifetime final) LLM 결과 캐시.
--   배경: audit-reports/2026-05-25-llm-cost-structure.md §5 후보 1 — 본편이 무캐시(cacheable:false),
--          매 요청마다 cold LLM 재호출(생성당 ≈ $0.094). 평생소장권 재열람 시 중복 과금.
--   content-addressed: cache_key = SHA256(pillars + dayMaster + gender + context(관계/직업/고민)
--     + counselorId + targetYear + reportHash(= LLM enhance된 챕터 포함 report 해시)
--     + recentFeedbackSummary + prompt_version). reading/user 비종속 → 동일 입력은 사용자 무관 dedup.
--   ai_total_review_interpretations(036) 패턴 복제 + Phase 0b용 토큰/비용 + 디버그 컬럼 추가.
--   서버(service role) 전용 캐시 — RLS 활성 + 공개 정책 없음(anon/authenticated 차단, service role만 bypass).
CREATE TABLE IF NOT EXISTS ai_lifetime_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT,
  source TEXT NOT NULL CHECK (source IN ('llm', 'fallback')),
  output_json JSONB NOT NULL,
  reasons JSONB,
  -- 디버그/조회용 입력 메타 (키에는 해시로 반영됨 — 여기서는 가독성/운영 조회용)
  saju_summary JSONB,                          -- {pillars, dayMaster, gender}
  counselor_id TEXT,
  target_year INTEGER,
  context JSONB,                               -- {relationshipStatus, occupation, concern}
  -- 토큰·비용 (선택, Phase 0b LLM telemetry 통합 시 활용)
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),         -- freshness(TTL 30일) 기준 (036 동일 패턴)
  UNIQUE (cache_key, prompt_version)            -- 조회 인덱스 겸용(get: eq cache_key + eq prompt_version)
);

-- 콘텐츠 해시 캐시라 reading/user 연결이 없음 → 클라이언트 노출 불필요.
-- RLS 활성 + 공개 정책 미부여 = service role 서버 접근만 허용 (036과 동일).
ALTER TABLE ai_lifetime_interpretations ENABLE ROW LEVEL SECURITY;
