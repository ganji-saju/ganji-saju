import type { LifetimeStrategySection } from '@/domain/saju/report/lifetime-types';
import type { ChapterLLMInput } from './chapter-input-types';
import {
  generateChapter,
  type ChapterLLMClient,
  type GenerateChapterOptions,
} from './generate-chapter';

// 2026-05-20 V2-5 PR K — 챕터 9 (평생 활용 전략) LLM synthesis.
//
// 기존 deterministic 본문 (LifetimeStrategySection.summary) 을 LLM synthesis 로
// 교체. LLM 호출 시 priorChapterDigests (1~7장 핵심) 를 입력에 포함시켜
// 1~7장 본문 *복사* 가 아닌 *재해석 압축* 을 강제. (report-llm-spec.md §4-9)
//
// LLM 실패 시 원본 deterministic summary 유지 (source='fallback') — 회귀 0.
//
// 1·4·5 챕터와 다른 점:
//   - 1·4·5 는 *그 챕터의 데이터* 만 LLM 에 전달 (cross-chapter 침범 차단).
//   - 9 는 사주 데이터 + **priorChapterDigests** 1~7개 를 같이 전달
//     (synthesis 의 정의: 다른 챕터 결을 재해석).
//   - chapter-prompts.ts:CHAPTER_OUTPUT_SPECS[9] 의 structureGuide 가
//     "3~5개 평생 원칙" + "1~7장 같은 문장 복사 금지" 를 명시 → validator
//     의 cross-chapter rule 이 첫 문장 중복을 차단.

export interface EnhanceChapter9Result {
  /** LLM enhancement 가 적용된 (또는 fallback 으로 원본 유지된) lifetimeStrategy */
  lifetimeStrategy: LifetimeStrategySection;
  /** llm = LLM 응답 사용 / fallback = 원본 deterministic summary 유지 */
  source: 'llm' | 'fallback';
  /** 재시도 횟수 */
  retries: number;
}

/**
 * 챕터 9 (평생 활용 전략) LLM synthesis.
 *
 * 흐름:
 *  1. generateChapter() 호출 (chapterId=9, priorChapterDigests 포함, fallbackBody=원본 summary)
 *  2. LLM 성공 시 lifetimeStrategy.summary 만 enhanced 본문으로 교체
 *  3. 다른 필드 (headline, useWhenStrong, defendWhenShaken, rememberRules, basis) 는 그대로
 *  4. LLM 실패 시 원본 lifetimeStrategy 그대로 반환
 *
 * 다른 챕터 enhance 와 다른 점 — chapterId 검증 (9 이어야 함) + priorChapterDigests 필수.
 */
export async function enhanceLifetimeChapter9WithLLM(
  lifetimeStrategy: LifetimeStrategySection,
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<EnhanceChapter9Result> {
  if (input.chapterId !== 9) {
    throw new Error(
      `enhanceLifetimeChapter9WithLLM: input.chapterId 는 9 이어야 함 (실제: ${input.chapterId})`
    );
  }
  if (!input.priorChapterDigests || input.priorChapterDigests.length === 0) {
    throw new Error(
      'enhanceLifetimeChapter9WithLLM: priorChapterDigests 누락 — 9장은 synthesis 챕터라 1~7장 digest 가 필수입니다.'
    );
  }

  const result = await generateChapter(input, client, {
    ...options,
    fallbackBody: lifetimeStrategy.summary,
  });

  return {
    lifetimeStrategy: {
      ...lifetimeStrategy,
      summary: result.body || lifetimeStrategy.summary,
    },
    source: result.source,
    retries: result.retries,
  };
}
