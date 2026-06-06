// 2026-05-23 — 궁합 깊은 풀이 LLM 진입점(②-b). ohaeng-guidance/generate 패턴.
//   흐름: 플래그 확인 → (OFF면 fallback) → 캐시 read-through → LLM 생성(재시도) → 파싱·검증
//         → 통과 시 캐시 후 llm, 아니면 결정론 fallback.
import type { CompatibilityInterpretation } from '@/lib/compatibility';
import type { ChapterLLMClient } from '../chapters/generate-chapter';
import { createOpenAITotalReviewClient } from '../total-review/openai-total-review-client';
import { recordLlmRun } from '@/server/ai/llm-telemetry';
import { buildCompatibilityInterpretationInput } from './compatibility-interpretation-content';
import {
  COMPATIBILITY_INTERPRETATION_PROMPT_VERSION,
  buildCompatibilityInterpretationCacheKey,
  isCompatibilityInterpretationLLMEnabled,
} from './compatibility-interpretation-cache';
import {
  COMPATIBILITY_INTERPRETATION_SYSTEM_PROMPT,
  buildCompatibilityInterpretationUserMessage,
} from './compatibility-interpretation-prompts';
import {
  parseCompatibilitySections,
  validateCompatibilitySections,
} from './compatibility-interpretation-validator';
import {
  createSupabaseCompatibilityInterpretationCacheStore,
  type CompatibilityInterpretationCacheStore,
} from './compatibility-interpretation-cache-store';
import type {
  CompatibilityInterpretationInput,
  CompatibilityInterpretationResult,
  CompatibilityInterpretationSection,
} from './compatibility-interpretation-types';

export interface GenerateCompatibilityInterpretationArgs {
  interpretation: CompatibilityInterpretation;
  selfName: string;
  partnerName: string;
  /** 테스트 결정성용 */
  now?: Date;
  /** DI — 미지정 시 총평 OpenAI 클라이언트(자유 텍스트) 재사용 */
  client?: ChapterLLMClient;
  /** 플래그 판정용 — 미지정 시 process.env */
  env?: NodeJS.ProcessEnv;
  maxRetries?: number;
  /** DI — 미지정 시 Supabase 캐시 스토어. 테스트는 in-memory 주입. */
  cacheStore?: CompatibilityInterpretationCacheStore;
  /** 원본 user id(해시되어 텔레메트리에 귀속). 비로그인/미상이면 null. */
  userId?: string | null;
  /** DI — 미지정 시 recordLlmRun. 테스트는 스파이 주입해 fallback 계측을 단언. */
  recordRun?: typeof recordLlmRun;
}

const MAX_OUTPUT_TOKENS = 1400;

function toSections(
  parsed: { title: string; body: string }[]
): CompatibilityInterpretationSection[] {
  return parsed.map((section, index) => ({
    key: `llm-${index + 1}`,
    title: section.title,
    body: section.body,
  }));
}

export async function generateCompatibilityInterpretation(
  args: GenerateCompatibilityInterpretationArgs
): Promise<CompatibilityInterpretationResult> {
  const env = args.env ?? process.env;
  const recordRun = args.recordRun ?? recordLlmRun;
  const userId = args.userId ?? null;
  const now = args.now ?? new Date();
  const input: CompatibilityInterpretationInput = buildCompatibilityInterpretationInput(
    args.interpretation,
    args.selfName,
    args.partnerName
  );
  const cacheKey = buildCompatibilityInterpretationCacheKey(input);
  const meta = {
    generatedAt: now.toISOString(),
    cacheKey,
    promptVersion: COMPATIBILITY_INTERPRETATION_PROMPT_VERSION,
  };

  if (!isCompatibilityInterpretationLLMEnabled(env)) {
    return { source: 'fallback', sections: input.fallbackSections, reasons: ['llm_disabled'], meta };
  }

  // 영속 캐시 read-through: 같은 커플·관계는 1회만 OpenAI 호출(재열람마다 차감 방지).
  const cacheStore =
    args.cacheStore ?? createSupabaseCompatibilityInterpretationCacheStore();
  const cached = await cacheStore.get(cacheKey);
  if (cached) {
    await recordRun({ feature: 'compatibility', source: 'cache', model: cached.model, userId });
    return {
      source: 'cache',
      sections: cached.sections,
      reasons: [],
      meta: { ...meta, generatedAt: cached.generatedAt },
    };
  }

  const client =
    args.client ??
    createOpenAITotalReviewClient({ maxOutputTokens: MAX_OUTPUT_TOKENS, feature: 'compatibility' });
  const maxRetries = args.maxRetries ?? 2;
  const userMessage = buildCompatibilityInterpretationUserMessage(input);
  let lastReasons: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let raw = '';
    try {
      raw = await client.generate(COMPATIBILITY_INTERPRETATION_SYSTEM_PROMPT, userMessage);
    } catch (error) {
      lastReasons = [`LLM 호출 실패: ${error instanceof Error ? error.message : String(error)}`];
      continue;
    }

    const parsed = parseCompatibilitySections(raw);
    if (!parsed) {
      lastReasons = ['JSON 파싱 실패'];
      continue;
    }

    const validation = validateCompatibilitySections(parsed);
    if (validation.ok) {
      const sections = toSections(parsed);
      // 'llm' 통과 결과만 캐시 (fallback 은 캐시하지 않아 일시 실패가 고착되지 않게).
      await cacheStore.set(cacheKey, { sections });
      return { source: 'llm', sections, reasons: [], meta };
    }
    lastReasons = validation.reasons;
  }

  // 관측성: OpenAI 호출은 됐으나 파싱·검증 실패로 결정론 fallback 으로 떨어진 경우.
  //   generateAiText 는 호출(openai/api-fallback)만 기록하므로, "출력이 거부돼 fallback"
  //   되는 사각지대를 여기서 source='fallback' + 사유로 기록(결제자 무음 fallback 가시화).
  await recordRun({
    feature: 'compatibility',
    source: 'fallback',
    model: null,
    userId,
    fallbackReason: lastReasons.join(' | ').slice(0, 500) || 'unknown',
  });

  return { source: 'fallback', sections: input.fallbackSections, reasons: lastReasons, meta };
}
