// 2026-05-25 Phase 0b — 전 LLM 호출 + 캐시 hit 텔레메트리 (console.log + ai_llm_runs DB).
//   배경: audit-reports/2026-05-25-admin-inventory.md §6 — 관측이 대운 챕터(chapter_run)에만 존재.
//   chapter-telemetry.ts 의 단가표/hashUserId 패턴 복제(상수 소폭 중복 — chapter-telemetry 미수정).
//   - LLM 호출(openai/fallback): generateAiText 중앙 계측.
//   - 캐시 hit(source='cache'): 서비스 호출처가 기록(캐시 스토어는 불변·순수 유지).
//   logLlmRun(=chapter_run 과 별도 함수) → 추후 챕터 이중로깅 정리 시 1지점 제어 가능.
import { createHash } from 'node:crypto';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export type LlmFeature =
  | 'interpret'
  | 'total_review'
  | 'yearly'
  | 'lifetime'
  | 'chapter'
  | 'compatibility'
  | 'chat'
  | 'home_banner';

export type LlmRunSource = 'openai' | 'fallback' | 'cache';

export interface LlmRunRecord {
  feature: LlmFeature;
  source: LlmRunSource;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number;
  durationMs: number | null;
  userIdHash: string | null;
  fallbackReason: string | null;
}

export interface BuildLlmRunInput {
  feature: LlmFeature;
  source: LlmRunSource;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  /** 원본 user id (해시되어 저장). 비로그인/미상이면 미지정 → userIdHash null. */
  userId?: string | null;
  /** source='fallback' 일 때만 의미. 'ai_not_configured'|'empty_ai_response'|'quota_exceeded'|'openai_error'. */
  fallbackReason?: string | null;
}

/** OpenAI Responses 모델별 단가 (USD per 1M tokens). chapter-telemetry 와 동일. */
const MODEL_PRICING_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-5.2': { input: 1.25, output: 10.0 },
  'gpt-5.2-chat-latest': { input: 1.25, output: 10.0 },
  'gpt-5-chat-latest': { input: 1.25, output: 10.0 },
};
const DEFAULT_PRICING = { input: 1.25, output: 10.0 };

/** LLM 호출 비용(USD). 토큰 정보 없으면 0. 알 수 없는 모델은 default 단가. */
export function estimateLlmCostUsd(
  model: string | null | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined
): number {
  if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') return 0;
  const pricing = (model ? MODEL_PRICING_PER_M_TOKENS[model] : undefined) ?? DEFAULT_PRICING;
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** user id → sha256 16자 prefix (개인정보 가드). null/빈값 → undefined. */
export function hashUserId(rawId: string | null | undefined): string | undefined {
  if (!rawId) return undefined;
  return createHash('sha256').update(rawId).digest('hex').slice(0, 16);
}

/** 입력 → LlmRunRecord (순수). cache 는 cost 0, 토큰 없음. */
export function buildLlmRunRecord(input: BuildLlmRunInput): LlmRunRecord {
  const costUsd =
    input.source === 'cache'
      ? 0
      : estimateLlmCostUsd(input.model, input.inputTokens, input.outputTokens);
  return {
    feature: input.feature,
    source: input.source,
    model: input.model ?? null,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    costUsd,
    durationMs: input.durationMs ?? null,
    userIdHash: hashUserId(input.userId) ?? null,
    fallbackReason: input.fallbackReason ?? null,
  };
}

const TABLE = 'ai_llm_runs';

export interface LlmTelemetryStore {
  insert(record: LlmRunRecord): Promise<void>;
}

/** 테스트/DI 용 인메모리 스토어. */
export function createInMemoryLlmTelemetryStore(): LlmTelemetryStore & { records: LlmRunRecord[] } {
  const records: LlmRunRecord[] = [];
  return {
    records,
    async insert(record) {
      records.push(record);
    },
  };
}

/** 운영용 Supabase 스토어. env/테이블/네트워크 문제 시 no-op (응답 비차단). */
export function createSupabaseLlmTelemetryStore(): LlmTelemetryStore {
  return {
    async insert(record) {
      if (!hasSupabaseServiceEnv) return;
      try {
        const supabase = await createServiceClient();
        await supabase.from(TABLE).insert({
          feature: record.feature,
          source: record.source,
          model: record.model,
          input_tokens: record.inputTokens,
          output_tokens: record.outputTokens,
          cost_usd: record.costUsd,
          duration_ms: record.durationMs,
          user_id_hash: record.userIdHash,
          fallback_reason: record.fallbackReason,
        });
      } catch {
        // 텔레메트리는 사용자 응답을 막지 않는다.
      }
    },
  };
}

/** console 한 줄 JSON (Vercel 로그 grep: "llm_run"). chapter_run 과 별도 함수. */
export function logLlmRun(record: LlmRunRecord): void {
  console.log(
    JSON.stringify({ event: 'llm_run', timestamp: new Date().toISOString(), ...record })
  );
}

let defaultStore: LlmTelemetryStore | null = null;
function getDefaultStore(): LlmTelemetryStore {
  if (!defaultStore) defaultStore = createSupabaseLlmTelemetryStore();
  return defaultStore;
}

/**
 * LLM 호출/캐시 hit 1건 기록: console.log + DB insert(await, 비차단).
 * store 미지정 시 Supabase. buildLlmRunRecord → logLlmRun → store.insert(내부 try/catch).
 * 어떤 경우에도 throw 하지 않음 (호출부 응답 보호).
 */
export async function recordLlmRun(
  input: BuildLlmRunInput,
  store: LlmTelemetryStore = getDefaultStore()
): Promise<void> {
  try {
    const record = buildLlmRunRecord(input);
    logLlmRun(record);
    await store.insert(record);
  } catch {
    // 비차단.
  }
}
