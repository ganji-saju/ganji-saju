// 2026-05-19 V2-5 PR I — 챕터 LLM 결과 캐시 키 + TTL + env flag helper.
//   audit-reports/2026-05-19-v2-5-llm-integration-design.md §2-3, §3-1 참고.
import { createHash } from 'node:crypto';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { ChapterUserContext } from './chapter-input-types';

export const CHAPTER_CACHE_TTL_DAYS = 30;

/**
 * 챕터 LLM 결과 캐시 키.
 * 키 일치 = 같은 사주 + 같은 사용자 컨텍스트 + 같은 챕터 → 같은 LLM 결과 재사용.
 *
 * pillars 의 ganzi (한자 ganzi) + dayMaster 의 stem/element + userContext 의
 * relevant fields 만 포함. 사주 메타데이터 (calculatedAt 등) 는 cacheKey 에
 * 포함 안 함 (시간이 다른 같은 사주는 캐시 hit 되어야 함).
 */
export function buildChapterCacheKey(
  sajuData: SajuDataV1 | SajuDataV2,
  userContext: ChapterUserContext,
  chapterId: number
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
    userContext: {
      age: userContext.age,
      relationshipStatus: userContext.relationshipStatus,
      occupation: userContext.occupation,
      currentConcern: userContext.currentConcern,
    },
    chapterId,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * 캐시 만료 체크. TTL 30일 (시즌 라벨 변경 가능성 — report-llm-spec.md §9-3).
 */
export function isChapterCacheFresh(
  generatedAt: string,
  ttlDays: number = CHAPTER_CACHE_TTL_DAYS,
  now: Date = new Date()
): boolean {
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return false;
  const ageMs = now.getTime() - generated.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs < ttlMs;
}

/**
 * env OPENAI_INTERPRET_CHAPTER_IDS 파싱.
 * 형태: '1' / '1,4,5' / '1-9' / '1,4-7'. 빈 문자열 / undefined 면 빈 set.
 */
export function parseEnabledChapterIds(raw: string | undefined): Set<number> {
  const enabled = new Set<number>();
  if (!raw) return enabled;
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [fromRaw, toRaw] = part.split('-');
      const from = Number(fromRaw?.trim());
      const to = Number(toRaw?.trim());
      if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
      for (let i = from; i <= to; i += 1) {
        if (i >= 1 && i <= 9) enabled.add(i);
      }
    } else {
      const id = Number(part);
      if (Number.isInteger(id) && id >= 1 && id <= 9) enabled.add(id);
    }
  }
  return enabled;
}

/**
 * env OPENAI_INTERPRET_CHAPTERS=1 이고 chapterId 가 활성 set 에 포함되면 true.
 * 기본값 (env 미설정): 모든 챕터 LLM disable → 기존 deterministic 본문 그대로.
 */
export function isChapterLLMEnabled(
  chapterId: number,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.OPENAI_INTERPRET_CHAPTERS !== '1') return false;
  const enabled = parseEnabledChapterIds(env.OPENAI_INTERPRET_CHAPTER_IDS);
  return enabled.has(chapterId);
}
