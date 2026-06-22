-- 2026-06-22 — 무결과 꿈 검색어 수요 로깅.
--   꿈해몽 피드백("검색해도 없다" = 커버리지 갭) 대응. /api/dream/search 가 searchDream
--   결과의 fallback=true(진짜 무결과)일 때 검색어를 빈도 누적 기록한다. 이 Top-N 이
--   사전 키워드 확장(LLM 배치 생성 → 가드 → 머지)의 우선순위 신호가 된다.
--   normalized_query PK + 빈도 증가 → 행 수 유한(중복 검색은 카운트만 증가).

CREATE TABLE IF NOT EXISTS public.dream_search_misses (
  normalized_query TEXT PRIMARY KEY,
  raw_query TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dream_search_misses_demand_idx
  ON public.dream_search_misses (hit_count DESC, last_seen DESC);

-- service_role(서버 라우트)만 접근. 공개 정책 없음 → anon/authenticated 직접 접근 0.
ALTER TABLE public.dream_search_misses ENABLE ROW LEVEL SECURITY;

-- 멱등 upsert + 빈도 증가. 서버가 무결과 시 호출(원자적 on-conflict 증가).
CREATE OR REPLACE FUNCTION public.record_dream_search_miss(p_normalized TEXT, p_raw TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.dream_search_misses (normalized_query, raw_query, hit_count, first_seen, last_seen)
  VALUES (p_normalized, p_raw, 1, now(), now())
  ON CONFLICT (normalized_query)
  DO UPDATE SET hit_count = dream_search_misses.hit_count + 1, last_seen = now();
$$;

-- anon/authenticated 직접 실행 차단 — 서버(service_role)만 호출.
REVOKE ALL ON FUNCTION public.record_dream_search_miss(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dream_search_miss(TEXT, TEXT) TO service_role;

COMMENT ON TABLE public.dream_search_misses IS
  '무결과 꿈 검색어 수요 로깅(빈도 누적). 사전 키워드 확장 우선순위 신호. service_role 전용.';
