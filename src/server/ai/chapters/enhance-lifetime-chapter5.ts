import type { LifetimeWealthStyleSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-20 V2-5 PR J — 챕터 5 (재물 감각) LLM enhancement.
//   PR #261 의 enhanceLifetimeChapter1WithLLM 과 동일 패턴.
//   LifetimeWealthStyleSection.summary 만 LLM 으로 교체.
//   LLM 실패 시 원본 summary 보존 (source='fallback').

export interface EnhanceChapter5Result {
  wealthStyle: LifetimeWealthStyleSection;
  source: 'llm' | 'fallback';
  retries: number;
}

export async function enhanceLifetimeChapter5WithLLM(
  wealthStyle: LifetimeWealthStyleSection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter5Result> {
  if (input.chapterId !== 5) {
    throw new Error(
      `enhanceLifetimeChapter5WithLLM: input.chapterId 는 5 이어야 함 (실제: ${input.chapterId})`
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: wealthStyle.summary,
  });

  return {
    wealthStyle: {
      ...wealthStyle,
      summary: result.body || wealthStyle.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
