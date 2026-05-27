import type { LifetimeHealthRhythmSection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-20 V2-5 PR L — 챕터 7 (건강 리듬) LLM enhancement.
//   교체 대상: healthRhythm.summary
//
// 의료법 측면 가드는 chapter-prompts.ts:CHAPTER_META[7].forbiddenTopics 에 명시:
//   - 구체적 질병 진단 — 절대 금지
//   - 특정 약·영양제 추천 — 금지
// generateChapter() 의 validator 가 자극 문구·단정 문구를 차단.

export interface EnhanceChapter7Result {
  healthRhythm: LifetimeHealthRhythmSection;
  source: 'llm' | 'fallback';
  retries: number;
}

export async function enhanceLifetimeChapter7WithLLM(
  healthRhythm: LifetimeHealthRhythmSection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter7Result> {
  if (input.chapterId !== 7) {
    throw new Error(
      `enhanceLifetimeChapter7WithLLM: input.chapterId 는 7 이어야 함 (실제: ${input.chapterId})`
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: healthRhythm.summary,
  });

  return {
    healthRhythm: {
      ...healthRhythm,
      summary: result.body || healthRhythm.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
