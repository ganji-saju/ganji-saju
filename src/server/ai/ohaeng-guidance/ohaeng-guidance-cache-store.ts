// 2026-05-21 — 오행 가이드 영속 캐시 스토어(캐시 후속). total-review-cache-store 패턴 복제.
//   목적: 플래그 ON 시 *조회마다* OpenAI 호출되던 비용을 *오행 분포당 1회* 로(content-addressed dedup).
//   DI: generateOhaengGuidance 가 주입받아 read-through. 테스트는 in-memory.
//   Supabase 스토어는 방어적(테이블/env 없으면 no-op·null) — 절대 사용자 응답을 막지 않음.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  OHAENG_GUIDANCE_PROMPT_VERSION,
  isOhaengGuidanceCacheFresh,
} from './ohaeng-guidance-cache';

const CACHE_TABLE = 'ai_ohaeng_guidance_interpretations';

export interface CachedOhaengGuidance {
  guidanceText: string;
  model: string | null;
  generatedAt: string;
}

export interface SetOhaengGuidanceCacheValue {
  guidanceText: string;
  model?: string | null;
  reasons?: string[];
}

export interface OhaengGuidanceCacheStore {
  get(cacheKey: string): Promise<CachedOhaengGuidance | null>;
  set(cacheKey: string, value: SetOhaengGuidanceCacheValue): Promise<void>;
}

/** 테스트/DI 용 인메모리 스토어. 프로세스 수명 동안만 유지. */
export function createInMemoryOhaengGuidanceCacheStore(): OhaengGuidanceCacheStore {
  const map = new Map<string, CachedOhaengGuidance>();
  return {
    async get(cacheKey) {
      return map.get(cacheKey) ?? null;
    },
    async set(cacheKey, value) {
      map.set(cacheKey, {
        guidanceText: value.guidanceText,
        model: value.model ?? null,
        generatedAt: new Date().toISOString(),
      });
    },
  };
}

/**
 * 운영용 Supabase 스토어.
 * - get: cache_key + prompt_version 으로 조회, fresh + source='llm' 만 반환.
 * - set: source='llm' 만 upsert (fallback 은 캐시하지 않음 — 일시 실패 고착 방지).
 * 모든 경로 방어적: env/테이블/네트워크 문제 시 null/no-op (사용자 응답 비차단).
 */
export function createSupabaseOhaengGuidanceCacheStore(
  now: () => Date = () => new Date()
): OhaengGuidanceCacheStore {
  return {
    async get(cacheKey) {
      if (!hasSupabaseServiceEnv) return null;
      try {
        const supabase = await createServiceClient();
        const { data, error } = await supabase
          .from(CACHE_TABLE)
          .select('guidance_text, model, source, updated_at')
          .eq('cache_key', cacheKey)
          .eq('prompt_version', OHAENG_GUIDANCE_PROMPT_VERSION)
          .maybeSingle();
        if (error || !data) return null;
        const row = data as {
          guidance_text: string;
          model: string | null;
          source: string;
          updated_at: string;
        };
        if (row.source !== 'llm') return null;
        if (!isOhaengGuidanceCacheFresh(row.updated_at, undefined, now())) return null;
        return {
          guidanceText: row.guidance_text,
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
            prompt_version: OHAENG_GUIDANCE_PROMPT_VERSION,
            model: value.model ?? null,
            source: 'llm',
            guidance_text: value.guidanceText,
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
