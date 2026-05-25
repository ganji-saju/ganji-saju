// 2026-05-25 Phase 0a — 대운 본편(lifetime final) 캐시 키 + TTL. total-review-cache.ts 패턴 복제.
//   배경: audit-reports/2026-05-25-llm-cost-structure.md §5 후보 1 — 본편이 무캐시(매 요청 cold).
//   결정요인 전부 포함(정확성): saju(pillars+dayMaster) + gender + context(관계/직업/고민)
//   + counselorId + targetYear + reportHash(= LLM enhance된 챕터 포함 report 해시)
//   + recentFeedbackSummary + promptVersion. 사주 메타(calculatedAt 등)는 제외 → 시간 무관 hit.
import { createHash } from 'node:crypto';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';

/** 캐시 TTL(일). total-review와 동일. */
export const LIFETIME_CACHE_TTL_DAYS = 30;

export interface LifetimeCacheKeyContext {
  relationshipStatus?: string | null;
  occupation?: string | null;
  concern?: string | null;
  gender?: string | null;
  /** 상담사 — 본편 instructions·프롬프트버전이 상담사별이라 키에 포함. */
  counselorId: string;
  /** 대상 연도 — buildLifetimeReport(targetYear)로 본문에 반영되므로 키에 포함. */
  targetYear: number;
  /**
   * 본편 프롬프트 input에 통째로 직렬화되는 report 의 해시.
   * report 는 LLM enhance된 챕터 요약을 포함 → 챕터 출력 변화가 본편 키에 반영된다.
   * hashLifetimeReport()로 계산해 넘긴다.
   */
  reportHash: string;
  /**
   * 사용자별·시변 입력. 본편 프롬프트 규칙상 "있으면 단정 강도 조정"에 사용 →
   * 정확성을 위해 키에 포함(피드백 변하면 캐시 무효화). 비로그인은 null.
   */
  recentFeedbackSummary?: string | null;
  /** counselor별 프롬프트 버전(getLifetimeInterpretationPromptVersion). 변경 시 캐시 무효화. */
  promptVersion: string;
}

/**
 * report(JSON) → SHA256. 본편 프롬프트가 report 를 통째로 직렬화하므로,
 * 이 해시를 캐시 키에 넣으면 (LLM enhance된) 챕터 변화가 본편 키에 정확히 반영된다.
 */
export function hashLifetimeReport(report: unknown): string {
  return createHash('sha256').update(JSON.stringify(report)).digest('hex');
}

/**
 * 본편 캐시 키. 같은 사주 + 컨텍스트 + 상담사 + 연도 + 리포트(챕터) + 피드백 + 프롬프트버전
 * → 같은 결과 재사용. content-addressed(비로그인 포함).
 */
export function buildLifetimeCacheKey(
  sajuData: SajuDataV1 | SajuDataV2,
  ctx: LifetimeCacheKeyContext
): string {
  const payload = JSON.stringify({
    pillars: {
      year: sajuData.pillars.year.ganzi,
      month: sajuData.pillars.month.ganzi,
      day: sajuData.pillars.day.ganzi,
      hour: sajuData.pillars.hour?.ganzi ?? null,
    },
    dayMaster: {
      stem: sajuData.dayMaster.stem,
      element: sajuData.dayMaster.element,
    },
    gender: ctx.gender ?? null,
    context: {
      relationshipStatus: ctx.relationshipStatus ?? null,
      occupation: ctx.occupation ?? null,
      concern: ctx.concern ?? null,
    },
    counselorId: ctx.counselorId,
    targetYear: ctx.targetYear,
    reportHash: ctx.reportHash,
    feedback: ctx.recentFeedbackSummary ?? null,
    promptVersion: ctx.promptVersion,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/** 캐시 만료 체크 (TTL 30일). total-review의 isTotalReviewCacheFresh와 동일 로직. */
export function isLifetimeCacheFresh(
  generatedAt: string,
  ttlDays: number = LIFETIME_CACHE_TTL_DAYS,
  now: Date = new Date()
): boolean {
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return false;
  const ageMs = now.getTime() - generated.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs < ttlMs;
}
