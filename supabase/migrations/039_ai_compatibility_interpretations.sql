-- 2026-05-23 — 궁합 LLM 깊은 풀이 결과 캐시 (②-b). 037(오행 가이드) 패턴 동일.
--   content-addressed: cache_key = (두 사람 명식 식별자[정렬] + 관계유형 + prompt_version) sha256.
--   사용자 비종속 + 순서 무관(A↔B) → 같은 커플·관계는 1회만 OpenAI 호출(재열람마다 차감 방지).
--   서버(service role) 전용 캐시 — RLS 활성 + 공개 정책 없음(anon/authenticated 차단, service role만 bypass).
CREATE TABLE IF NOT EXISTS ai_compatibility_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT,
  source TEXT NOT NULL CHECK (source IN ('llm', 'fallback')),
  sections JSONB NOT NULL,
  reasons JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cache_key, prompt_version)
);

-- 콘텐츠 해시 캐시라 reading/user 연결이 없음 → 클라이언트 노출 불필요.
-- RLS 활성 + 공개 정책 미부여 = service role 서버 접근만 허용.
ALTER TABLE ai_compatibility_interpretations ENABLE ROW LEVEL SECURITY;
