// 2026-05-19 V2-5 PR I — 챕터별 LLM 결과 envelope.
//   readings.ts 의 result_json envelope 에 _chapters field 로 저장된다.
//   audit-reports/2026-05-19-v2-5-llm-integration-design.md §2-1 참고.
import type { ChapterId } from './chapter-input-types';

export const PERSISTED_CHAPTER_ENVELOPE_V1 = 'reading-chapters/v1' as const;

export type PersistedChapterEnvelopeVersion = typeof PERSISTED_CHAPTER_ENVELOPE_V1;

export interface PersistedChapterEntry {
  chapterId: ChapterId;
  /** LLM 결과 본문 (또는 fallback 본문) */
  body: string;
  /** llm = LLM 응답 사용. fallback = deterministic builder 결과 유지. */
  source: 'llm' | 'fallback';
  retries: 0 | 1 | 2;
  /** sha256(saju.pillars + saju.dayMaster + userContext.relevantFields + chapterId) */
  cacheKey: string;
  /** ISO timestamp — TTL 체크 (기본 30일) */
  generatedAt: string;
  /** 후처리 검증 실패 rule (운영 추적용) */
  validationFailures: string[];
}

export interface PersistedChapterEnvelope {
  schemaVersion: PersistedChapterEnvelopeVersion;
  /** envelope 자체 생성 시각 (가장 최근 챕터 업데이트 시각) */
  generatedAt: string;
  promptVersion: string;
  model: string;
  /** 챕터별 entry. 부분 채움 가능 (예: 챕터 1 만 LLM, 나머지는 deterministic). */
  chapters: Partial<Record<ChapterId, PersistedChapterEntry>>;
}
