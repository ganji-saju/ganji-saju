// 2026-05-25 Phase 0a — 대운 본편 LLM 결과 영속 캐시 스토어. total-review-cache-store.ts 패턴 복제.
//   목적: 플래그 무관 *페이지 조회마다* OpenAI 재호출되던 본편 비용을 *사주+컨텍스트(+챕터/피드백)당 1회*로.
//   DI: generateLifetimeInterpretation 가 LifetimeCacheStore 를 주입받아 read-through. 테스트는 in-memory.
//   Supabase 스토어는 방어적(테이블/env 없으면 no-op·null) — 절대 사용자 응답을 막지 않음.
//   total-review 와 차이: lifetime 의 prompt_version 은 counselor별 동적이라 get/set 에 인자로 전달.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { isLifetimeCacheFresh } from './lifetime-interpretation-cache';

const CACHE_TABLE = 'ai_lifetime_interpretations';

export interface CachedLifetimeInterpretation<T> {
  output: T;
  model: string | null;
  generatedAt: string;
}

export interface SetLifetimeCacheValue<T> {
  output: T;
  model?: string | null;
  reasons?: string[];
  // 디버그/Phase 0b 메타 (선택)
  sajuSummary?: unknown;
  counselorId?: string;
  targetYear?: number;
  context?: unknown;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
}

export interface LifetimeCacheStore<T = unknown> {
  get(cacheKey: string, promptVersion: string): Promise<CachedLifetimeInterpretation<T> | null>;
  set(cacheKey: string, promptVersion: string, value: SetLifetimeCacheValue<T>): Promise<void>;
}

/** 테스트/DI 용 인메모리 스토어. 프로세스 수명 동안만 유지. */
export function createInMemoryLifetimeCacheStore<T = unknown>(): LifetimeCacheStore<T> {
  const map = new Map<string, CachedLifetimeInterpretation<T>>();
  const composite = (cacheKey: string, promptVersion: string) => `${promptVersion}:${cacheKey}`;
  return {
    async get(cacheKey, promptVersion) {
      return map.get(composite(cacheKey, promptVersion)) ?? null;
    },
    async set(cacheKey, promptVersion, value) {
      map.set(composite(cacheKey, promptVersion), {
        output: value.output,
        model: value.model ?? null,
        generatedAt: new Date().toISOString(),
      });
    },
  };
}

/**
 * 운영용 Supabase 스토어.
 * - get: cache_key + prompt_version 으로 조회, fresh(TTL 30일) + source='llm' 만 반환.
 * - set: source='llm' 만 upsert (fallback 은 호출부에서 set 자체를 건너뜀 — 일시 실패 고착 방지).
 * 모든 경로 방어적: env/테이블/네트워크 문제 시 null/no-op (사용자 응답 비차단).
 */
export function createSupabaseLifetimeCacheStore<T = unknown>(
  now: () => Date = () => new Date()
): LifetimeCacheStore<T> {
  return {
    async get(cacheKey, promptVersion) {
      if (!hasSupabaseServiceEnv) return null;
      try {
        const supabase = await createServiceClient();
        const { data, error } = await supabase
          .from(CACHE_TABLE)
          .select('output_json, model, source, updated_at')
          .eq('cache_key', cacheKey)
          .eq('prompt_version', promptVersion)
          .maybeSingle();
        if (error || !data) return null;
        const row = data as {
          output_json: T;
          model: string | null;
          source: string;
          updated_at: string;
        };
        if (row.source !== 'llm') return null;
        if (!isLifetimeCacheFresh(row.updated_at, undefined, now())) return null;
        return {
          output: row.output_json,
          model: row.model ?? null,
          generatedAt: row.updated_at,
        };
      } catch {
        return null;
      }
    },
    async set(cacheKey, promptVersion, value) {
      if (!hasSupabaseServiceEnv) return;
      try {
        const supabase = await createServiceClient();
        await supabase.from(CACHE_TABLE).upsert(
          {
            cache_key: cacheKey,
            prompt_version: promptVersion,
            model: value.model ?? null,
            source: 'llm',
            output_json: value.output,
            reasons: value.reasons ?? null,
            saju_summary: value.sajuSummary ?? null,
            counselor_id: value.counselorId ?? null,
            target_year: value.targetYear ?? null,
            context: value.context ?? null,
            input_tokens: value.inputTokens ?? null,
            output_tokens: value.outputTokens ?? null,
            cost_usd: value.costUsd ?? null,
            updated_at: now().toISOString(),
          },
          { onConflict: 'cache_key,prompt_version' }
        );
      } catch {
        // 캐시 쓰기는 사용자 응답을 막지 않는다.
      }
    },
  };
}
