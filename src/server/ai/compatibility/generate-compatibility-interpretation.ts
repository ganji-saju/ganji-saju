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

const MAX_OUTPUT_TOKENS = 6000;
// 2026-10-12 — 섹션 6개 풀이는 1회 27~30초라 30초 제한에 자주 걸렸다(로컬 실측 8회 중 3회). 호출 제한은 55초로,
//   대신 route maxDuration(180초) 안에서 끝나도록(예산 160초 + 앞뒤 여유 20초) 남은 시간이 한 번의 호출보다 짧으면 다시 시도하지 않는다.
export const COMPATIBILITY_LLM_TIMEOUT_MS = 55_000;
export const COMPATIBILITY_LLM_BUDGET_MS = 160_000;

/** 지금까지 쓴 시간으로 다음 호출을 시작해도 되는지(최악의 경우에도 예산 안에서 끝나는지). */
export function canStartCompatibilityAttempt(elapsedMs: number): boolean {
  return elapsedMs + COMPATIBILITY_LLM_TIMEOUT_MS <= COMPATIBILITY_LLM_BUDGET_MS;
}

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
  // 시간 예산은 함수 진입부터 잰다(캐시 조회 포함) — route 인증 등 앞단 몇 초와 끝의 저장·기록은 예산 밖 여유(20초)로 둔다.
  const startedAt = Date.now();
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
    // 관측성: 플래그 OFF 로 LLM 을 건너뛴 경우도 기록한다. 미기록 시 ai_llm_runs 에서
    //   "플래그 OFF(설정)"와 "유료 §8 트래픽 없음"이 똑같이 0행으로 보여 구분이 안 된다.
    //   fallback_reason='llm_disabled' 로 검증실패 fallback 과 구분 가능.
    await recordRun({
      feature: 'compatibility',
      source: 'fallback',
      model: null,
      userId,
      fallbackReason: 'llm_disabled',
    });
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
    createOpenAITotalReviewClient({ maxOutputTokens: MAX_OUTPUT_TOKENS, timeoutMs: COMPATIBILITY_LLM_TIMEOUT_MS, feature: 'compatibility', userId });
  const maxRetries = args.maxRetries ?? 2;
  const userMessage = buildCompatibilityInterpretationUserMessage(input);
  let lastReasons: string[] = [];
  // 모델에게 되돌려 줄 사유는 출력 자체의 문제(형식·검증)만 — 호출 오류 문구는 넘기지 않는다.
  let feedback: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (!canStartCompatibilityAttempt(Date.now() - startedAt)) {
      lastReasons = [...lastReasons, '시간 예산 초과로 재시도 중단'];
      break;
    }
    let raw = '';
    try {
      // 재시도는 직전 탈락 사유를 같이 넘긴다 — 같은 입력만 다시 보내면 같은 실수를 반복한다.
      const message = feedback.length
        ? `${userMessage}\n\n직전 출력이 아래 이유로 탈락했습니다. 고쳐서 다시 작성하세요:\n${feedback.map((r) => `- ${r}`).join('\n')}`
        : userMessage;
      raw = await client.generate(COMPATIBILITY_INTERPRETATION_SYSTEM_PROMPT, message);
    } catch (error) {
      lastReasons = [`LLM 호출 실패: ${error instanceof Error ? error.message : String(error)}`];
      continue;
    }

    const parsed = parseCompatibilitySections(raw);
    if (!parsed) {
      lastReasons = ['JSON 파싱 실패'];
      feedback = ['JSON 형식이 아님 — 지정한 JSON 객체 하나만 출력'];
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
    feedback = validation.reasons;
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
