-- 2026-05-21 — 오행 LLM 가이드 결과 캐시 (점수 Phase 5 후속). 036 패턴 동일.
--   content-addressed: cache_key = (오행 counts + dominant + lack + excess + balanceLevel + prompt_version) sha256.
--   사용자/사주 비종속 → 동일 오행 분포는 무관하게 dedup (재활성 시 분포당 1회만 OpenAI 호출).
--   서버(service role) 전용 캐시 — RLS 활성 + 공개 정책 없음(anon/authenticated 차단, service role만 bypass).
CREATE TABLE IF NOT EXISTS ai_ohaeng_guidance_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT,
  source TEXT NOT NULL CHECK (source IN ('llm', 'fallback')),
  guidance_text TEXT NOT NULL,
  reasons JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cache_key, prompt_version)
);

-- 콘텐츠 해시 캐시라 reading/user 연결이 없음 → 클라이언트 노출 불필요.
-- RLS 활성 + 공개 정책 미부여 = service role 서버 접근만 허용.
ALTER TABLE ai_ohaeng_guidance_interpretations ENABLE ROW LEVEL SECURITY;
