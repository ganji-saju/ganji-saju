import type { LifetimeCoreIdentitySection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-19 (a) 점진 마이그레이션 1단계 — 챕터 1 (타고난 성향) LLM enhancement.
//   기존 deterministic 본문 (LifetimeCoreIdentitySection.summary) 을 LLM 으로
//   교체. LLM 실패 시 원본 그대로 fallback (source='fallback').

export interface EnhanceChapter1Result {
  /** LLM enhancement 가 적용된 (또는 fallback 으로 원본 유지된) coreIdentity */
  coreIdentity: LifetimeCoreIdentitySection;
  /** llm = LLM 응답 사용 / fallback = 원본 deterministic summary 유지 */
  source: 'llm' | 'fallback';
  /** 재시도 횟수 */
  retries: number;
}

/**
 * 챕터 1 (타고난 성향) LLM enhancement.
 *
 * 흐름:
 *  1. generateChapter() 호출 (fallbackBody=원본 summary)
 *  2. LLM 성공 시 coreIdentity.summary 만 enhanced 본문으로 교체
 *  3. 다른 필드 (headline, reactionStyle, bestEnvironment, weakPattern, basis) 는 그대로
 *  4. LLM 실패 시 원본 coreIdentity 그대로 반환
 */
export async function enhanceLifetimeChapter1WithLLM(
  coreIdentity: LifetimeCoreIdentitySection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter1Result> {
  if (input.chapterId !== 1) {
    throw new Error(
      `enhanceLifetimeChapter1WithLLM: input.chapterId 는 1 이어야 함 (실제: ${input.chapterId})`
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: coreIdentity.summary,
  });

  return {
    coreIdentity: {
      ...coreIdentity,
      summary: result.body || coreIdentity.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
