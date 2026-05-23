// 2026-05-23 — 궁합 깊은 풀이 영속 캐시 스토어(②-b). ohaeng-guidance-cache-store 패턴.
//   목적: 플래그 ON 시 *재열람마다* OpenAI 호출되던 비용을 *커플·관계당 1회* 로(content-addressed dedup).
//   DI: generate 가 주입받아 read-through. 테스트는 in-memory.
//   Supabase 스토어는 방어적(테이블/env 없으면 no-op·null) — 절대 사용자 응답을 막지 않음.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  COMPATIBILITY_INTERPRETATION_PROMPT_VERSION,
  isCompatibilityInterpretationCacheFresh,
} from './compatibility-interpretation-cache';
import type { CompatibilityInterpretationSection } from './compatibility-interpretation-types';

const CACHE_TABLE = 'ai_compatibility_interpretations';

export interface CachedCompatibilityInterpretation {
  sections: CompatibilityInterpretationSection[];
  model: string | null;
  generatedAt: string;
}

export interface SetCompatibilityInterpretationCacheValue {
  sections: CompatibilityInterpretationSection[];
  model?: string | null;
  reasons?: string[];
}

export interface CompatibilityInterpretationCacheStore {
  get(cacheKey: string): Promise<CachedCompatibilityInterpretation | null>;
  set(cacheKey: string, value: SetCompatibilityInterpretationCacheValue): Promise<void>;
}

/** 테스트/DI 용 인메모리 스토어. 프로세스 수명 동안만 유지. */
export function createInMemoryCompatibilityInterpretationCacheStore(): CompatibilityInterpretationCacheStore {
  const map = new Map<string, CachedCompatibilityInterpretation>();
  return {
    async get(cacheKey) {
      return map.get(cacheKey) ?? null;
    },
    async set(cacheKey, value) {
      map.set(cacheKey, {
        sections: value.sections,
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
export function createSupabaseCompatibilityInterpretationCacheStore(
  now: () => Date = () => new Date()
): CompatibilityInterpretationCacheStore {
  return {
    async get(cacheKey) {
      if (!hasSupabaseServiceEnv) return null;
      try {
        const supabase = await createServiceClient();
        const { data, error } = await supabase
          .from(CACHE_TABLE)
          .select('sections, model, source, updated_at')
          .eq('cache_key', cacheKey)
          .eq('prompt_version', COMPATIBILITY_INTERPRETATION_PROMPT_VERSION)
          .maybeSingle();
        if (error || !data) return null;
        const row = data as {
          sections: CompatibilityInterpretationSection[];
          model: string | null;
          source: string;
          updated_at: string;
        };
        if (row.source !== 'llm') return null;
        if (!Array.isArray(row.sections) || row.sections.length === 0) return null;
        if (!isCompatibilityInterpretationCacheFresh(row.updated_at, undefined, now())) return null;
        return {
          sections: row.sections,
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
            prompt_version: COMPATIBILITY_INTERPRETATION_PROMPT_VERSION,
            model: value.model ?? null,
            source: 'llm',
            sections: value.sections,
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
