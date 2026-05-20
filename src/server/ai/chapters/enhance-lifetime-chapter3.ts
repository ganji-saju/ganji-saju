import type { LifetimePatternAndYongsinSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-20 V2-5 PR L — 챕터 3 (역할과 보완 힌트) LLM enhancement.
//   교체 대상: patternAndYongsin.summary

export interface EnhanceChapter3Result {
  patternAndYongsin: LifetimePatternAndYongsinSection;
  source: 'llm' | 'fallback';
  retries: number;
}

export async function enhanceLifetimeChapter3WithLLM(
  patternAndYongsin: LifetimePatternAndYongsinSection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter3Result> {
  if (input.chapterId !== 3) {
    throw new Error(
      `enhanceLifetimeChapter3WithLLM: input.chapterId 는 3 이어야 함 (실제: ${input.chapterId})`
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: patternAndYongsin.summary,
  });

  return {
    patternAndYongsin: {
      ...patternAndYongsin,
      summary: result.body || patternAndYongsin.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
