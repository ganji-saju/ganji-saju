-- 2026-05-21 — 사주 총평 LLM 결과 캐시.
--   content-addressed: cache_key = (사주 pillars + 성별 + 컨텍스트 + prompt_version) sha256 해시.
--   reading 비종속 → 동일 사주+컨텍스트는 사용자와 무관하게 dedup (재활성 시 사주당 1회만 OpenAI 호출).
--   서버(service role) 전용 캐시 — RLS 활성 + 공개 정책 없음(anon/authenticated 차단, service role만 bypass).
CREATE TABLE IF NOT EXISTS ai_total_review_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT,
  source TEXT NOT NULL CHECK (source IN ('llm', 'fallback')),
  output_json JSONB NOT NULL,
  reasons JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cache_key, prompt_version)
);

-- 콘텐츠 해시 캐시라 reading/user 연결이 없음 → 클라이언트 노출 불필요.
-- RLS 활성 + 공개 정책 미부여 = service role 서버 접근만 허용.
ALTER TABLE ai_total_review_interpretations ENABLE ROW LEVEL SECURITY;
