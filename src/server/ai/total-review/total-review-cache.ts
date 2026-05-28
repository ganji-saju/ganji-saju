// 2026-05-21 — 총평 LLM 결과 캐시 키 + TTL + env flag. chapter-cache.ts 패턴 복제.
//   키 = (birth + gender + name + context_hash). 이름/컨텍스트(관계/직업/고민) 변경 시 재생성.
import { createHash } from 'node:crypto';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';

/** 프롬프트/스키마 버전 — 변경 시 캐시 무효화. */
export const TOTAL_REVIEW_PROMPT_VERSION = 'total-review/v2';

export const TOTAL_REVIEW_CACHE_TTL_DAYS = 30;

export interface TotalReviewCacheKeyContext {
  relationshipStatus?: string | null;
  occupation?: string | null;
  concern?: string | null;
  gender?: string | null;
  userName?: string | null;
}

/**
 * 총평 캐시 키. 같은 사주 + 같은 성별 + 같은 이름 + 같은 컨텍스트 → 같은 결과 재사용.
 * 사주 메타(calculatedAt 등)는 제외 — 시간이 다른 같은 사주는 캐시 hit.
 */
export function buildTotalReviewCacheKey(
  sajuData: SajuDataV1 | SajuDataV2,
  context: TotalReviewCacheKeyContext
): string {
  const userName = normalizeCacheText(context.userName);
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
    gender: context.gender ?? null,
    userName,
    context: {
      relationshipStatus: normalizeCacheText(context.relationshipStatus),
      occupation: normalizeCacheText(context.occupation),
      concern: normalizeCacheText(context.concern),
    },
    promptVersion: TOTAL_REVIEW_PROMPT_VERSION,
  });
  return createHash('sha256').update(payload).digest('hex');
}

function normalizeCacheText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';
  return normalized.length > 0 ? normalized : null;
}

/** 캐시 만료 체크 (TTL 30일). */
export function isTotalReviewCacheFresh(
  generatedAt: string,
  ttlDays: number = TOTAL_REVIEW_CACHE_TTL_DAYS,
  now: Date = new Date()
): boolean {
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return false;
  const ageMs = now.getTime() - generated.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs < ttlMs;
}

/**
 * env OPENAI_INTERPRET_TOTAL_REVIEW=1 일 때만 총평 LLM 활성.
 * 기본값(미설정): 비활성 → 기존 deterministic 본문(buildSajuNarrative) fallback 유지.
 */
export function isTotalReviewLLMEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.OPENAI_INTERPRET_TOTAL_REVIEW === '1';
}
