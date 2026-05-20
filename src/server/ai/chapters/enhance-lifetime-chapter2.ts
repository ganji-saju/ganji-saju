import type { LifetimeStrengthBalanceSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-20 V2-5 PR L — 챕터 2 (기운의 균형) LLM enhancement.
//   1·4·5 와 동일 패턴: summary 만 교체, 다른 필드 보존.
//   교체 대상: strengthBalance.summary

export interface EnhanceChapter2Result {
  strengthBalance: LifetimeStrengthBalanceSection;
  source: 'llm' | 'fallback';
  retries: number;
}

export async function enhanceLifetimeChapter2WithLLM(
  strengthBalance: LifetimeStrengthBalanceSection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter2Result> {
  if (input.chapterId !== 2) {
    throw new Error(
      `enhanceLifetimeChapter2WithLLM: input.chapterId 는 2 이어야 함 (실제: ${input.chapterId})`
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: strengthBalance.summary,
  });

  return {
    strengthBalance: {
      ...strengthBalance,
      summary: result.body || strengthBalance.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
