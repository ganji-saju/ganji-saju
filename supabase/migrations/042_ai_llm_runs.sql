-- 2026-05-25 Phase 0b — LLM 호출/캐시 hit 텔레메트리 로그 (append-only).
--   배경: audit-reports/2026-05-25-admin-inventory.md §6 — LLM 관측이 대운 챕터(chapter_run)에만 존재.
--   generateAiText 중앙 계측(source='openai'|'fallback') + 서비스 캐시 hit(source='cache', cost 0) 적재.
--   feature: 'interpret'|'total_review'|'yearly'|'lifetime'|'chapter'|'compatibility'|'chat'|'home_banner'.
--   user_id_hash: sha256 16자 prefix(개인정보 가드, 비로그인 NULL). 캐시 hit 행은 토큰 NULL·cost 0.
--   서버(service role) 전용 — RLS 활성 + 공개 정책 없음(anon/authenticated 차단, service role만 bypass).
CREATE TABLE IF NOT EXISTS ai_llm_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('openai', 'fallback', 'cache')),
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  duration_ms INTEGER,
  user_id_hash TEXT,                            -- 비로그인/미상 NULL
  fallback_reason TEXT,                         -- source='fallback'일 때만
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 영역별 일별 집계(비용/호출수/hit률) 최적화.
CREATE INDEX IF NOT EXISTS ai_llm_runs_feature_created_idx ON ai_llm_runs (feature, created_at);
CREATE INDEX IF NOT EXISTS ai_llm_runs_created_idx ON ai_llm_runs (created_at);

-- 콘텐츠/사용자 연결 없는 운영 로그 → 클라이언트 노출 불필요.
-- RLS 활성 + 공개 정책 미부여 = service role 서버 접근만 허용 (036/041 패턴).
ALTER TABLE ai_llm_runs ENABLE ROW LEVEL SECURITY;
