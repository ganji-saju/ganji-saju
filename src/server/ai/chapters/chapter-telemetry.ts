// 2026-05-19 V2-5 PR I — 챕터 LLM 호출/캐시 hit 1차 monitoring (console.log).
//   audit-reports/2026-05-19-v2-5-llm-integration-design.md §3-2 참고.
//   2차 (운영 telemetry 테이블 + 일별 집계 view) 는 별도 PR.
import type { ChapterId } from './chapter-input-types';

export interface ChapterRunTelemetry {
  chapterId: ChapterId;
  source: 'llm' | 'cache' | 'fallback';
  durationMs: number;
  retries: number;
  cacheKey: string;
  validationFailures: string[];
  errorMessage?: string;
}

/**
 * 챕터 LLM 호출/캐시 hit 1차 monitoring — console.log 한 줄 JSON.
 * Vercel runtime logs 에서 grep 가능 ("chapter_run" 키워드).
 */
export function logChapterRun(telemetry: ChapterRunTelemetry): void {
  const payload = {
    event: 'chapter_run',
    timestamp: new Date().toISOString(),
    ...telemetry,
  };
  console.log(JSON.stringify(payload));
}
