// 2026-05-21 — 오행 가이드 LLM 진입점(Phase 5). total-review-service 패턴(lean 단문 버전).
//   흐름: 플래그 확인 → (없으면 fallback) → LLM 생성(재시도) → validate → 통과 시 llm, 아니면 fallback.
//   ※ 영속 캐시(Supabase)는 후속 PR — 플래그 OFF 기본이라 비용 이슈 없음. cacheKey 는 meta 노출.
import type { OhaengChartData } from '@/lib/saju-score';
import type { ChapterLLMClient } from '../chapters/generate-chapter';
import { createOpenAITotalReviewClient } from '../total-review/openai-total-review-client';
import {
  buildOhaengGuidanceInput,
  buildDeterministicOhaengGuidance,
} from './ohaeng-guidance-content';
import { validateOhaengGuidance } from './ohaeng-guidance-validator';
import {
  OHAENG_GUIDANCE_PROMPT_VERSION,
  buildOhaengGuidanceCacheKey,
  isOhaengGuidanceLLMEnabled,
} from './ohaeng-guidance-cache';
import {
  OHAENG_GUIDANCE_SYSTEM_PROMPT,
  buildOhaengGuidanceUserMessage,
} from './ohaeng-guidance-prompts';
import {
  createSupabaseOhaengGuidanceCacheStore,
  type OhaengGuidanceCacheStore,
} from './ohaeng-guidance-cache-store';
import type { OhaengGuidanceResult } from './ohaeng-guidance-types';

export interface GenerateOhaengGuidanceArgs {
  chart: OhaengChartData;
  /** 테스트 결정성용 */
  now?: Date;
  /** DI — 미지정 시 총평 OpenAI 클라이언트(자유 텍스트) 재사용 */
  client?: ChapterLLMClient;
  /** 플래그 판정용 — 미지정 시 process.env */
  env?: NodeJS.ProcessEnv;
  maxRetries?: number;
  /** DI — 미지정 시 Supabase 캐시 스토어. 테스트는 in-memory 주입. */
  cacheStore?: OhaengGuidanceCacheStore;
}

const MAX_OUTPUT_TOKENS = 400;
const MIN_LEN = 20;
const MAX_LEN = 320;

export async function generateOhaengGuidance(
  args: GenerateOhaengGuidanceArgs
): Promise<OhaengGuidanceResult> {
  const env = args.env ?? process.env;
  const now = args.now ?? new Date();
  const input = buildOhaengGuidanceInput(args.chart);
  const fallbackText = buildDeterministicOhaengGuidance(input);
  const cacheKey = buildOhaengGuidanceCacheKey(input);
  const meta = {
    generatedAt: now.toISOString(),
    cacheKey,
    promptVersion: OHAENG_GUIDANCE_PROMPT_VERSION,
  };

  if (!isOhaengGuidanceLLMEnabled(env)) {
    return { source: 'fallback', guidanceText: fallbackText, reasons: ['llm_disabled'], meta };
  }

  // 영속 캐시 read-through: 같은 오행 분포는 1회만 OpenAI 호출(조회마다 차감 방지).
  const cacheStore = args.cacheStore ?? createSupabaseOhaengGuidanceCacheStore();
  const cached = await cacheStore.get(cacheKey);
  if (cached) {
    return {
      source: 'cache',
      guidanceText: cached.guidanceText,
      reasons: [],
      meta: { ...meta, generatedAt: cached.generatedAt },
    };
  }

  const client =
    args.client ?? createOpenAITotalReviewClient({ maxOutputTokens: MAX_OUTPUT_TOKENS });
  const maxRetries = args.maxRetries ?? 2;
  const userMessage = buildOhaengGuidanceUserMessage(input);
  let lastReasons: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let raw = '';
    try {
      raw = await client.generate(OHAENG_GUIDANCE_SYSTEM_PROMPT, userMessage);
    } catch (error) {
      lastReasons = [
        `LLM 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
      ];
      continue;
    }

    const text = raw.trim();
    const len = [...text].length;
    if (len < MIN_LEN || len > MAX_LEN) {
      lastReasons = [`가이드 길이 ${len}자 (${MIN_LEN}~${MAX_LEN})`];
      continue;
    }

    const validation = validateOhaengGuidance(text);
    if (validation.ok) {
      // 'llm' 통과 결과만 캐시 (fallback 은 캐시하지 않아 일시 실패가 고착되지 않게).
      await cacheStore.set(cacheKey, { guidanceText: text, reasons: [] });
      return { source: 'llm', guidanceText: text, reasons: [], meta };
    }
    lastReasons = validation.reasons;
  }

  return { source: 'fallback', guidanceText: fallbackText, reasons: lastReasons, meta };
}
