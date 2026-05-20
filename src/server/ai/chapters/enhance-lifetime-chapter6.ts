import type { LifetimeCareerDirectionSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-20 V2-5 PR L — 챕터 6 (직업 방향) LLM enhancement.
//   교체 대상: careerDirection.summary

export interface EnhanceChapter6Result {
  careerDirection: LifetimeCareerDirectionSection;
  source: 'llm' | 'fallback';
  retries: number;
}

export async function enhanceLifetimeChapter6WithLLM(
  careerDirection: LifetimeCareerDirectionSection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter6Result> {
  if (input.chapterId !== 6) {
    throw new Error(
      `enhanceLifetimeChapter6WithLLM: input.chapterId 는 6 이어야 함 (실제: ${input.chapterId})`
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: careerDirection.summary,
  });

  return {
    careerDirection: {
      ...careerDirection,
      summary: result.body || careerDirection.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
