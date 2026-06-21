// Task 6 — 오늘운세 LLM 오케스트레이터 (플래그 → 캐시 → 프롬프트 → 생성 → 검증 → 폴백).
//
// 핵심 흐름:
//  1. 플래그 OFF → null (결정론 유지).
//  2. 캐시 히트 → source:'cache' 즉시 반환.
//  3. 미스 → grounding + prompt → generateAiText → parseTodayFortuneNarrative → cache write → 반환.
//
// parseTodayFortuneNarrative 는 순수 함수로 분리 → 단위 테스트 가능.

import { isTodayFortuneLlmEnabled } from '@/server/ai/today-fortune/flag';

/** validateChapterBody 가 잡지 못하는 단정 표현 — today-fortune 전용 추가 금지 토큰. */
const TODAY_FORTUNE_EXTRA_FORBIDDEN = ['100%', '무조건'];
import { buildTodayFortuneGrounding } from '@/server/ai/today-fortune/grounding';
import {
  createTodayFortunePrompt,
  buildTodayFortuneFallbackText,
  TODAY_FORTUNE_PROMPT_VERSION,
} from '@/server/ai/today-fortune/prompt';
import {
  readTodayFortuneAi,
  writeTodayFortuneAi,
  type TodayFortuneCacheKey,
} from '@/server/ai/today-fortune/cache';
import { generateAiText, getOpenAIInterpretationModel } from '@/server/ai/openai-text';
import { validateChapterBody } from '@/lib/saju/chapter-validator';
import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';
import type { SajuDataV1, SajuDataV2 } from '@/domain/saju/engine';

export interface TodayFortuneNarrative {
  headline: string;
  body: string;
  source: 'openai' | 'fallback' | 'cache';
}

/**
 * LLM 응답 텍스트를 파싱하고 검증하여 narrative 를 반환하는 순수 함수.
 *
 * - JSON 파싱 실패 → fallback
 * - headline/body 문자열 부재 → fallback
 * - validateChapterBody(headline + ' ' + body).passed === false → fallback
 * - 모두 통과 → source: 'openai'
 */
export function parseTodayFortuneNarrative(
  text: string,
  fallback: { headline: string; body: string }
): { headline: string; body: string; source: 'openai' | 'fallback' } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).headline !== 'string' ||
      typeof (parsed as Record<string, unknown>).body !== 'string'
    ) {
      return { ...fallback, source: 'fallback' };
    }

    const headline = (parsed as { headline: string; body: string }).headline;
    const body = (parsed as { headline: string; body: string }).body;

    const combined = headline + ' ' + body;

    const validation = validateChapterBody(combined);
    if (!validation.passed) {
      return { ...fallback, source: 'fallback' };
    }

    if (TODAY_FORTUNE_EXTRA_FORBIDDEN.some((t) => combined.includes(t))) {
      return { ...fallback, source: 'fallback' };
    }

    return { headline, body, source: 'openai' };
  } catch {
    return { ...fallback, source: 'fallback' };
  }
}

/**
 * 오늘운세 LLM 서사 생성 오케스트레이터.
 *
 * @returns TodayFortuneNarrative (source: openai|fallback|cache) 또는
 *          null (플래그 OFF — 결정론 유지).
 */
export async function generateTodayFortuneNarrative(args: {
  result: TodayFortuneFreeResult;
  sajuData: SajuDataV1 | SajuDataV2;
  caseSummaries: string[];
  situation: string | null;
  userId: string;
}): Promise<TodayFortuneNarrative | null> {
  const { result, sajuData, caseSummaries, situation, userId } = args;

  // Step 1: 플래그 OFF → 결정론 유지.
  if (!isTodayFortuneLlmEnabled()) return null;

  // Step 2: 캐시 조회.
  const key: TodayFortuneCacheKey = {
    userId,
    dateKey: result.dateKey,
    concernId: result.concernId,
    promptVersion: TODAY_FORTUNE_PROMPT_VERSION,
  };

  const cached = await readTodayFortuneAi(key);
  if (cached) {
    return { headline: cached.headline, body: cached.body, source: 'cache' };
  }

  // Step 3: grounding → prompt → LLM 호출.
  // spec §8: LLM 경로의 어떤 예외도 500 을 유발해선 안 된다 — fallback 으로 강등.
  const fallback = { headline: result.oneLine.headline, body: result.oneLine.body };

  try {
    const grounding = buildTodayFortuneGrounding({ result, sajuData, caseSummaries, situation });
    const { instructions, input } = createTodayFortunePrompt(grounding);

    const aiResult = await generateAiText({
      instructions,
      input,
      fallbackText: buildTodayFortuneFallbackText(fallback.headline, fallback.body),
      model: getOpenAIInterpretationModel(),
      maxOutputTokens: 500,
      temperature: 0.8,
      responseFormat: { type: 'text' },
      feature: 'today_fortune',
      userId,
    });

    // Step 4: 파싱 + 검증 (순수 함수).
    // aiResult.source === 'openai' 일 때만 LLM 텍스트를 파싱. 진짜 LLM 실패는 fallback 유지.
    const narrative =
      aiResult.source === 'openai' && aiResult.text
        ? parseTodayFortuneNarrative(aiResult.text, fallback)
        : { ...fallback, source: 'fallback' as const };

    // Step 5: 캐시 저장 (비차단 — 실패해도 응답에 영향 없음).
    // iljinGanzi: result.sajuChart?.todayGanzi 사용. 없으면 null.
    const iljinGanzi = result.sajuChart?.todayGanzi ?? null;

    await writeTodayFortuneAi(key, {
      headline: narrative.headline,
      body: narrative.body,
      source: narrative.source,
      model: aiResult.model,
      fallbackReason: aiResult.fallbackReason ?? null,
      iljinGanzi,
    });

    return narrative;
  } catch {
    // grounding/prompt/LLM 호출 중 예외 → 결정론 폴백으로 강등 (500 방지).
    return { headline: fallback.headline, body: fallback.body, source: 'fallback' as const };
  }
}
