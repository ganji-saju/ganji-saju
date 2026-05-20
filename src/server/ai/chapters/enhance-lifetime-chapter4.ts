import type { LifetimeRelationshipPatternSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-20 V2-5 PR J — 챕터 4 (관계 패턴) LLM enhancement.
//   PR #261 의 enhanceLifetimeChapter1WithLLM 과 동일 패턴.
//   LifetimeRelationshipPatternSection.summary 만 LLM 으로 교체.
//   LLM 실패 시 원본 summary 보존 (source='fallback').

export interface EnhanceChapter4Result {
  relationshipPattern: LifetimeRelationshipPatternSection;
  source: 'llm' | 'fallback';
  retries: number;
}

export async function enhanceLifetimeChapter4WithLLM(
  relationshipPattern: LifetimeRelationshipPatternSection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter4Result> {
  if (input.chapterId !== 4) {
    throw new Error(
      `enhanceLifetimeChapter4WithLLM: input.chapterId 는 4 이어야 함 (실제: ${input.chapterId})`
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: relationshipPattern.summary,
  });

  return {
    relationshipPattern: {
      ...relationshipPattern,
      summary: result.body || relationshipPattern.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
