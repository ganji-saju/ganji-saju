// 2026-05-21 — 총평 LLM 결과 영속 캐시 스토어. saju-yearly-service 의 read/write 패턴 복제.
//   목적: 플래그 ON 시 *페이지 조회마다* OpenAI 호출되던 비용을 *사주+컨텍스트당 1회* 로.
//   DI: generateTotalReview 가 TotalReviewCacheStore 를 주입받아 read-through. 테스트는 in-memory.
//   Supabase 스토어는 방어적(테이블/env 없으면 no-op·null) — 절대 사용자 응답을 막지 않음.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  TOTAL_REVIEW_PROMPT_VERSION,
  isTotalReviewCacheFresh,
} from './total-review-cache';
import type { TotalReviewOutput } from './total-review-types';

const CACHE_TABLE = 'ai_total_review_interpretations';

export interface CachedTotalReview {
  output: TotalReviewOutput;
  model: string | null;
  generatedAt: string;
}

export interface SetTotalReviewCacheValue {
  output: TotalReviewOutput;
  model?: string | null;
  reasons?: string[];
}

export interface TotalReviewCacheStore {
  get(cacheKey: string): Promise<CachedTotalReview | null>;
  set(cacheKey: string, value: SetTotalReviewCacheValue): Promise<void>;
}

/** 테스트/DI 용 인메모리 스토어. 프로세스 수명 동안만 유지. */
export function createInMemoryTotalReviewCacheStore(): TotalReviewCacheStore {
  const map = new Map<string, CachedTotalReview>();
  return {
    async get(cacheKey) {
      return map.get(cacheKey) ?? null;
    },
    async set(cacheKey, value) {
      map.set(cacheKey, {
        output: value.output,
        model: value.model ?? null,
        generatedAt: new Date().toISOString(),
      });
    },
  };
}

/**
 * 운영용 Supabase 스토어.
 * - get: cache_key + prompt_version 으로 조회, fresh + source='llm' 만 반환.
 * - set: source='llm' 만 upsert (fallback 은 캐시하지 않음 — 일시 실패가 고착되지 않게).
 * 모든 경로 방어적: env/테이블/네트워크 문제 시 null/no-op (사용자 응답 비차단).
 */
export function createSupabaseTotalReviewCacheStore(
  now: () => Date = () => new Date()
): TotalReviewCacheStore {
  return {
    async get(cacheKey) {
      if (!hasSupabaseServiceEnv) return null;
      try {
        const supabase = await createServiceClient();
        const { data, error } = await supabase
          .from(CACHE_TABLE)
          .select('output_json, model, source, updated_at')
          .eq('cache_key', cacheKey)
          .eq('prompt_version', TOTAL_REVIEW_PROMPT_VERSION)
          .maybeSingle();
        if (error || !data) return null;
        const row = data as {
          output_json: TotalReviewOutput;
          model: string | null;
          source: string;
          updated_at: string;
        };
        if (row.source !== 'llm') return null;
        if (!isTotalReviewCacheFresh(row.updated_at, undefined, now())) return null;
        return {
          output: row.output_json,
          model: row.model ?? null,
          generatedAt: row.updated_at,
        };
      } catch {
        return null;
      }
    },
    async set(cacheKey, value) {
      if (!hasSupabaseServiceEnv) return;
      try {
        const supabase = await createServiceClient();
        await supabase.from(CACHE_TABLE).upsert(
          {
            cache_key: cacheKey,
            prompt_version: TOTAL_REVIEW_PROMPT_VERSION,
            model: value.model ?? null,
            source: 'llm',
            output_json: value.output,
            reasons: value.reasons ?? null,
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
