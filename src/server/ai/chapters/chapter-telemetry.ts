// 2026-05-19 V2-5 PR I — 챕터 LLM 호출/캐시 hit 1차 monitoring (console.log).
//   audit-reports/2026-05-19-v2-5-llm-integration-design.md §3-2 참고.
// 2026-05-20 V2-5 PR Q — 모델/토큰/사용자 해시/비용 추적 보강 (검증 6 P1).
//   비용 추적 가시화 + 일별 집계용 필드 추가.
import { createHash } from 'node:crypto';
import type { ChapterId } from './chapter-input-types';

export interface ChapterRunTelemetry {
  chapterId: ChapterId;
  source: 'llm' | 'cache' | 'fallback';
  durationMs: number;
  retries: number;
  cacheKey: string;
  validationFailures: string[];
  errorMessage?: string;
  /**
   * 2026-05-20 V2-5 PR Q — 비용 추적 필드.
   * 모두 선택형 — LLM 호출 결과 (response.usage) 가 없거나 cache hit / fallback
   * 인 경우 미설정. 비용 계산은 estimateChapterCostUsd helper 가 수행.
   */
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** 모델 단가 × 토큰 수 계산값 (USD). */
  costUsd?: number;
  /**
   * 사용자 식별자 — 원본 ID 가 아닌 sha-256 해시 prefix (16자) 만 기록.
   *   개인정보 측면 가드 + 사용자별 통계 (예: 일별 비용/호출 수) 가능.
   *   해시 함수: hashUserId(rawId).
   */
  userIdHash?: string;
}

/**
 * 사용자 ID 를 sha-256 해시 prefix (16자) 로 변환 — 개인정보 측면 가드.
 * 같은 사용자 ID 는 같은 해시 → 일별 사용자별 집계 가능.
 */
export function hashUserId(rawId: string | null | undefined): string | undefined {
  if (!rawId) return undefined;
  return createHash('sha256').update(rawId).digest('hex').slice(0, 16);
}

/**
 * OpenAI Responses API 모델별 단가 (USD per 1M tokens).
 *   2026-05-20 당시 OpenAI 공식 단가. 모델 변경 시 갱신.
 *   알려지지 않은 모델은 default fallback 단가 (gpt-5.2 원칙 보수적 추정).
 */
const MODEL_PRICING_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-5.2': { input: 1.25, output: 10.0 },
  'gpt-5.2-chat-latest': { input: 1.25, output: 10.0 },
  'gpt-5-chat-latest': { input: 1.25, output: 10.0 },
};
const DEFAULT_PRICING = { input: 1.25, output: 10.0 };

/**
 * 챕터 LLM 호출 비용 (USD) 계산.
 *
 * @param model 호출 모델명 (예: 'gpt-5.2-chat-latest'). 알려지지 않으면 default 단가.
 * @param inputTokens 응답의 usage.input_tokens
 * @param outputTokens 응답의 usage.output_tokens
 * @returns USD (예: 0.0031). 토큰 정보 없으면 0 반환.
 */
export function estimateChapterCostUsd(
  model: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined
): number {
  if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') return 0;
  const pricing = (model ? MODEL_PRICING_PER_M_TOKENS[model] : undefined) ?? DEFAULT_PRICING;
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  // 6자리 소수 — micro-cost 가시화.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * 챕터 LLM 호출/캐시 hit 1차 monitoring — console.log 한 줄 JSON.
 * Vercel runtime logs 에서 grep 가능 ("chapter_run" 키워드).
 */
export function logChapterRun(telemetry: ChapterRunTelemetry): void {
  const payload = {
    event: 'chapter_run',
    timestamp: new Date().toISOString(),
    ...telemetry,
  };
  console.log(JSON.stringify(payload));
}

/**
 * 2026-05-20 V2-5 PR Q — logChapterRun + usage/userIdHash 자동 추출 wrapper.
 *
 * apply{Chapter,Lifetime}LLMEnhancement 의 *LLM success 위치* 에서 사용 권장.
 *   - client.lastUsage 에서 model/tokens 추출 → costUsd 계산
 *   - reading.userId 를 hashUserId 로 해시 → userIdHash 기록
 *   - cache hit / catch (fallback) 위치는 client 없음 → 원본 logChapterRun 그대로 사용 가능
 *     (userIdHash 만 추가하려면 telemetry 인자에 직접 hashUserId(reading.userId) 포함).
 */
export function logChapterRunWithUsage(
  telemetry: Omit<ChapterRunTelemetry, 'model' | 'inputTokens' | 'outputTokens' | 'costUsd' | 'userIdHash'>,
  context: {
    client?: { lastUsage?: { model: string; inputTokens?: number; outputTokens?: number } | null } | null;
    userId?: string | null;
  }
): void {
  const usage = context.client?.lastUsage;
  const enriched: ChapterRunTelemetry = {
    ...telemetry,
    userIdHash: hashUserId(context.userId),
    ...(usage && {
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: estimateChapterCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
    }),
  };
  logChapterRun(enriched);
}
