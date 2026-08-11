// 2026-05-21 — 총평 LLM 결과 영속 캐시 스토어. saju-yearly-service 의 read/write 패턴 복제.
//   목적: 플래그 ON 시 *페이지 조회마다* OpenAI 호출되던 비용을 *사주+컨텍스트당 1회* 로.
//   DI: generateTotalReview 가 TotalReviewCacheStore 를 주입받아 read-through. 테스트는 in-memory.
//   Supabase 스토어는 방어적(테이블/env 없으면 no-op·null) — 절대 사용자 응답을 막지 않음.
//
// 2026-08-12 — **섹션 단위**로 전환. 이전엔 전체 출력 1행이었고, 쓰기 조건이
//   "3섹션 전부 llm" 이었다. main_narrative 하나만 검증에 걸려도 성공한 나머지 두 섹션까지
//   버려져 캐시에 아무것도 안 남았고, 그 사주는 **조회할 때마다 3섹션을 다시 생성**했다.
//   실측(2026-08-12): openai 섹션콜 1,075 누적에 캐시행 84 — 시도의 25~40%만 적재.
//   이제 섹션마다 따로 적재해 성공한 섹션은 두 번 다시 생성하지 않고, 실패한 섹션만 재시도한다
//   (원 설계 의도인 "일시 실패를 고착시키지 않는다"는 그대로 유지된다).
//
//   저장 키는 `<cacheKey>:<sectionId>` — 기존 (cache_key, prompt_version) 유니크를 그대로 쓰므로
//   마이그레이션이 필요 없다.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  TOTAL_REVIEW_PROMPT_VERSION,
  isTotalReviewCacheFresh,
} from './total-review-cache';
import type {
  TotalReviewOutput,
  TotalReviewSectionId,
} from './total-review-types';

const CACHE_TABLE = 'ai_total_review_interpretations';

export const TOTAL_REVIEW_SECTION_IDS = [
  'one_line_summary',
  'main_narrative',
  'lifetime_keys',
] as const satisfies readonly TotalReviewSectionId[];

/** 섹션 하나가 책임지는 출력 조각. 예: { one_line_summary: '...' } */
export type TotalReviewSectionFragment = Partial<TotalReviewOutput>;

export interface CachedTotalReviewSection {
  fragment: TotalReviewSectionFragment;
  model: string | null;
  generatedAt: string;
}

export type CachedTotalReviewSections = Partial<
  Record<TotalReviewSectionId, CachedTotalReviewSection>
>;

export interface TotalReviewCacheStore {
  /** 섹션별 캐시를 한 번에 읽는다. 없는 섹션은 키 자체가 없다. */
  getSections(cacheKey: string): Promise<CachedTotalReviewSections>;
  /** 섹션 하나를 적재한다. llm 으로 생성 성공한 섹션만 호출할 것. */
  setSection(
    cacheKey: string,
    sectionId: TotalReviewSectionId,
    value: { fragment: TotalReviewSectionFragment; model?: string | null; reasons?: string[] }
  ): Promise<void>;
}

export function sectionCacheKey(cacheKey: string, sectionId: TotalReviewSectionId): string {
  return `${cacheKey}:${sectionId}`;
}

/** 전체 출력 1행이던 레거시 행을 섹션 조각으로 쪼갠다(재생성 없이 흡수). */
function splitLegacyOutput(output: TotalReviewOutput): CachedTotalReviewSections | null {
  if (!output || typeof output !== 'object') return null;
  const { one_line_summary, main_narrative, lifetime_keys } = output;
  if (
    typeof one_line_summary !== 'string' ||
    !main_narrative ||
    !Array.isArray(lifetime_keys)
  ) {
    return null;
  }
  return {
    one_line_summary: { fragment: { one_line_summary }, model: null, generatedAt: '' },
    main_narrative: { fragment: { main_narrative }, model: null, generatedAt: '' },
    lifetime_keys: { fragment: { lifetime_keys }, model: null, generatedAt: '' },
  };
}

/** 테스트/DI 용 인메모리 스토어. 프로세스 수명 동안만 유지. */
export function createInMemoryTotalReviewCacheStore(): TotalReviewCacheStore {
  const map = new Map<string, CachedTotalReviewSection>();
  return {
    async getSections(cacheKey) {
      const out: CachedTotalReviewSections = {};
      for (const sectionId of TOTAL_REVIEW_SECTION_IDS) {
        const hit = map.get(sectionCacheKey(cacheKey, sectionId));
        if (hit) out[sectionId] = hit;
      }
      return out;
    },
    async setSection(cacheKey, sectionId, value) {
      map.set(sectionCacheKey(cacheKey, sectionId), {
        fragment: value.fragment,
        model: value.model ?? null,
        generatedAt: new Date().toISOString(),
      });
    },
  };
}

/**
 * 운영용 Supabase 스토어.
 * - getSections: 섹션 3키 + 레거시 전체키를 **한 번의 쿼리**로 읽고, 섹션 행을 우선한다.
 *   섹션 행이 없으면 레거시 전체 행을 쪼개 채운다(전환 시 재생성 0).
 * - setSection: source='llm' 만 upsert (fallback 은 캐시하지 않음 — 일시 실패가 고착되지 않게).
 * 모든 경로 방어적: env/테이블/네트워크 문제 시 빈 결과/no-op (사용자 응답 비차단).
 */
export function createSupabaseTotalReviewCacheStore(
  now: () => Date = () => new Date()
): TotalReviewCacheStore {
  return {
    async getSections(cacheKey) {
      if (!hasSupabaseServiceEnv) return {};
      try {
        const supabase = await createServiceClient();
        const keys = [
          cacheKey, // 레거시 전체 출력 행
          ...TOTAL_REVIEW_SECTION_IDS.map((id) => sectionCacheKey(cacheKey, id)),
        ];
        const { data, error } = await supabase
          .from(CACHE_TABLE)
          .select('cache_key, output_json, model, source, updated_at')
          .in('cache_key', keys)
          .eq('prompt_version', TOTAL_REVIEW_PROMPT_VERSION);
        if (error || !data) return {};

        const rows = data as Array<{
          cache_key: string;
          output_json: TotalReviewOutput & TotalReviewSectionFragment;
          model: string | null;
          source: string;
          updated_at: string;
        }>;
        const usable = rows.filter(
          (row) => row.source === 'llm' && isTotalReviewCacheFresh(row.updated_at, undefined, now())
        );

        const out: CachedTotalReviewSections = {};
        for (const sectionId of TOTAL_REVIEW_SECTION_IDS) {
          const row = usable.find((r) => r.cache_key === sectionCacheKey(cacheKey, sectionId));
          if (row) {
            out[sectionId] = {
              fragment: row.output_json,
              model: row.model,
              generatedAt: row.updated_at,
            };
          }
        }

        // 섹션 행이 없는 자리는 레거시 전체 행으로 메운다.
        const legacy = usable.find((r) => r.cache_key === cacheKey);
        if (legacy) {
          const split = splitLegacyOutput(legacy.output_json);
          if (split) {
            for (const sectionId of TOTAL_REVIEW_SECTION_IDS) {
              if (out[sectionId]) continue;
              const piece = split[sectionId];
              if (!piece) continue;
              out[sectionId] = {
                fragment: piece.fragment,
                model: legacy.model,
                generatedAt: legacy.updated_at,
              };
            }
          }
        }

        return out;
      } catch {
        return {};
      }
    },
    async setSection(cacheKey, sectionId, value) {
      if (!hasSupabaseServiceEnv) return;
      try {
        const supabase = await createServiceClient();
        await supabase.from(CACHE_TABLE).upsert(
          {
            cache_key: sectionCacheKey(cacheKey, sectionId),
            prompt_version: TOTAL_REVIEW_PROMPT_VERSION,
            model: value.model ?? null,
            source: 'llm',
            output_json: value.fragment,
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
