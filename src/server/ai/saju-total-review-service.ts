// 2026-05-21 — 사주 총평 LLM 진입점. saju-total-review-llm-spec.md §8.
//   흐름: 플래그 확인 → 입력 빌드 → 3섹션 *병렬* 생성 → 조립 → validateTotalReview →
//   hard 위반 시 deterministic(buildSajuNarrative) fallback.
//   플래그 OFF(기본) 또는 hard 위반 시 source='fallback' → 페이지가 기존 카드로 graceful degrade.
//   ※ 영속 캐시(Supabase)는 후속 PR — 본 PR 은 플래그 OFF 기본이라 비용 이슈 없음. cacheKey 는 meta 노출.
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { SajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { buildSajuNarrative } from '@/domain/saju/report';
import type { SajuNarrative } from '@/domain/saju/report/build-narrative';
import {
  hasHardTotalReviewViolation,
  validateTotalReview,
} from '@/lib/saju/total-review-validator';
import type { ChapterLLMClient } from './chapters/generate-chapter';
import { createOpenAITotalReviewClient } from './total-review/openai-total-review-client';
import { buildTotalReviewInput } from './total-review/build-total-review-input';
import { generateTotalReviewSection } from './total-review/generate-total-review';
import {
  TOTAL_REVIEW_PROMPT_VERSION,
  buildTotalReviewCacheKey,
  isTotalReviewLLMEnabled,
} from './total-review/total-review-cache';
import {
  TOTAL_REVIEW_SECTION_IDS,
  createSupabaseTotalReviewCacheStore,
  type CachedTotalReviewSections,
  type TotalReviewCacheStore,
} from './total-review/total-review-cache-store';
import { recordLlmRun } from './llm-telemetry';
import type {
  TotalReviewOutput,
  TotalReviewSectionId,
} from './total-review/total-review-types';

export interface GenerateTotalReviewArgs {
  sajuData: SajuDataV1 | SajuDataV2;
  personalizationContext: SajuPersonalizationContext;
  userName?: string | null;
  gender?: 'M' | 'F' | null;
  /** 테스트 결정성용 */
  now?: Date;
  /** 테스트/DI 용 — 미지정 시 OpenAIChapterClient(자유텍스트 모드) */
  client?: ChapterLLMClient;
  /** 플래그 판정용 — 미지정 시 process.env */
  env?: NodeJS.ProcessEnv;
  maxRetries?: number;
  /** DI — 미지정 시 Supabase 캐시 스토어. 테스트는 in-memory 주입. */
  cacheStore?: TotalReviewCacheStore;
}

export interface TotalReviewResult {
  /** llm = 신규 생성 / cache = 캐시 hit / fallback = 플래그 OFF·hard 위반·일부 섹션 실패 */
  source: 'llm' | 'cache' | 'fallback';
  output: TotalReviewOutput;
  /** validateTotalReview 의 reasons (soft 포함, 로깅용) */
  reasons: string[];
  meta: { generatedAt: string; cacheKey: string; modelVersion: string };
}

// main_narrative(4단락 5~8문장)가 가장 큼 — 넉넉히. 작은 섹션은 조기 종료.
// 2026-08-31 — 프로덕션 실측(ai_llm_runs 최근 7일)으로 고친 두 숫자.
//   ① 출력 상한 1500 → 2600: 성공 호출의 **12% 가 정확히 1500 토큰**에서 끝났다 = 잘림.
//      프롬프트 자체가 본문 4단락 28~32문장(≈2,000~2,900자)을 요구하므로 main_narrative 는
//      1500 토큰에 **구조적으로** 안 들어간다. 잘린 JSON 은 parseLooseJson 이 실패 → 재시도
//      꼬리말("JSON 파싱 실패")은 길이를 못 고치니 같은 자리에서 또 잘림 → 3콜 낭비 후 fallback.
//      상한을 올려도 모델은 프롬프트 길이 규칙을 따르므로 짧은 섹션 비용은 그대로다.
//   ② 타임아웃 15s(openai-text 기본) → 40s: 실패 25건 전부 15,00x ms 에서 끊겼고(=SDK timeout),
//      성공 호출 p50 12s·p90 14s·max 14.9s 로 **성공이 타임아웃 벽에 붙어 있었다.**
//      상한을 올리면 출력이 길어져 더 자주 걸린다 — ①과 ②는 한 세트다.
//   ⚠️ 이 값들을 내리려면 먼저 /admin/llm-cost 의 total_review fallback 이 왜 늘지 않는지 확인할 것.
export const TOTAL_REVIEW_MAX_OUTPUT_TOKENS = 2600;
export const TOTAL_REVIEW_TIMEOUT_MS = 40_000;

/** 캐시 조각 + 신규 조각을 합쳐 완성 출력으로. 둘 다 없으면 deterministic 으로 메운다. */
function assembleOutput(
  cached: CachedTotalReviewSections,
  generated: Partial<Record<TotalReviewSectionId, { value: Partial<TotalReviewOutput> }>>,
  deterministic: TotalReviewOutput
): TotalReviewOutput {
  const pick = <K extends keyof TotalReviewOutput>(key: K): TotalReviewOutput[K] => {
    const fromCache = cached[key as TotalReviewSectionId]?.fragment[key];
    if (fromCache !== undefined) return fromCache as TotalReviewOutput[K];
    const fromNew = generated[key as TotalReviewSectionId]?.value[key];
    if (fromNew !== undefined) return fromNew as TotalReviewOutput[K];
    return deterministic[key];
  };
  return {
    one_line_summary: pick('one_line_summary'),
    main_narrative: pick('main_narrative'),
    lifetime_keys: pick('lifetime_keys'),
  };
}

function buildDeterministicOutput(narrative: SajuNarrative): TotalReviewOutput {
  return {
    one_line_summary: narrative.headline || '',
    main_narrative: {
      paragraph_1_who_you_are: narrative.body || '',
      paragraph_2_strong_environment: '',
      paragraph_3_weak_zone: '',
      paragraph_4_now: '',
    },
    lifetime_keys: [],
  };
}

export async function generateTotalReview(
  args: GenerateTotalReviewArgs
): Promise<TotalReviewResult> {
  const env = args.env ?? process.env;
  const now = args.now ?? new Date();
  const narrative = buildSajuNarrative(args.sajuData, args.personalizationContext, {
    userName: args.userName ?? null,
  });
  const deterministic = buildDeterministicOutput(narrative);
  const situation = args.personalizationContext.userSituation;
  const cacheKey = buildTotalReviewCacheKey(args.sajuData, {
    relationshipStatus: situation?.relationshipStatus ?? null,
    occupation: situation?.occupation ?? null,
    concern: situation?.currentConcern ?? null,
    gender: args.gender ?? null,
    userName: args.userName ?? null,
  });
  const meta = {
    generatedAt: now.toISOString(),
    cacheKey,
    modelVersion: TOTAL_REVIEW_PROMPT_VERSION,
  };

  if (!isTotalReviewLLMEnabled(env)) {
    return { source: 'fallback', output: deterministic, reasons: ['llm_disabled'], meta };
  }

  // 영속 캐시 read-through(**섹션 단위**): 이미 적재된 섹션은 다시 생성하지 않는다.
  //   2026-08-12 — 이전엔 전체 출력 1행 + "3섹션 전부 llm" 일 때만 쓰기였다. 한 섹션만 검증에
  //   걸려도 성공한 나머지까지 버려져 캐시가 안 남았고, 그 사주는 조회할 때마다 3콜을 다시 태웠다.
  const cacheStore = args.cacheStore ?? createSupabaseTotalReviewCacheStore();
  const cached = await cacheStore.getSections(cacheKey);

  const cachedGeneratedAt = TOTAL_REVIEW_SECTION_IDS.map((id) => cached[id]?.generatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  // 계측: 캐시로 아낀 섹션을 섹션 단위로 기록해야 openai(섹션콜)와 같은 축에서 비교된다.
  //   ⚠️ 병렬 — 순차로 await 하면 **완전 캐시 hit(가장 흔한 경로)** 에 DB 왕복 3번이 직렬로 붙는다.
  await Promise.all(
    TOTAL_REVIEW_SECTION_IDS.flatMap((sectionId) => {
      const hit = cached[sectionId];
      if (!hit) return [];
      return [recordLlmRun({ feature: 'total_review', source: 'cache', model: hit.model, userId: null })];
    })
  );

  const missing = TOTAL_REVIEW_SECTION_IDS.filter((sectionId) => !cached[sectionId]);

  if (missing.length === 0) {
    return {
      source: 'cache',
      output: assembleOutput(cached, {}, deterministic),
      reasons: [],
      meta: { ...meta, generatedAt: cachedGeneratedAt ?? meta.generatedAt },
    };
  }

  const input = buildTotalReviewInput(args.sajuData, args.personalizationContext, {
    userName: args.userName ?? null,
    gender: args.gender ?? null,
    now,
  });
  const client =
    args.client ??
    createOpenAITotalReviewClient({
      maxOutputTokens: TOTAL_REVIEW_MAX_OUTPUT_TOKENS,
      timeoutMs: TOTAL_REVIEW_TIMEOUT_MS,
    });
  const maxRetries = args.maxRetries ?? 2;

  const sectionFallbacks = {
    one_line_summary: { one_line_summary: deterministic.one_line_summary },
    main_narrative: { main_narrative: deterministic.main_narrative },
    lifetime_keys: { lifetime_keys: deterministic.lifetime_keys },
  } as const;

  const generatedList = await Promise.all(
    missing.map((sectionId) =>
      generateTotalReviewSection(sectionId, input, client, {
        maxRetries,
        // 섹션별 fallback 타입이 sectionId 에 종속이라 여기서만 좁힌다.
        fallback: sectionFallbacks[sectionId] as never,
      }).then((result) => [sectionId, result] as const)
    )
  );
  const generated = Object.fromEntries(generatedList) as Partial<
    Record<TotalReviewSectionId, { source: 'llm' | 'fallback'; value: Partial<TotalReviewOutput> }>
  >;

  // 새로 만든 섹션 중 llm 통과분만 적재 — 다른 섹션이 실패해도 이건 살아남는다(병렬).
  //   ⚠️ 이 적재는 아래 hasHardTotalReviewViolation 검사보다 **먼저** 와야 한다.
  //     한 섹션이 실패하면 그 자리는 deterministic 문구로 메워지는데, 그 문구는 LLM 검증기
  //     기준으로 깨끗하지 않아 **조립 검사가 거의 항상 걸린다**. 검사 뒤로 옮기면 정확히
  //     "부분 실패" 상황에서만 적재가 안 되어 이 PR 이 고치려는 낭비가 그대로 되살아난다
  //     (회귀 테스트가 잡았다: main_narrative 재생성 2회).
  //     조립 위반은 *빠진 섹션* 때문이지 캐시된 조각 때문이 아니라, 그 섹션이 나중에 성공하면
  //     저절로 해소된다 — 고착되지 않는다.
  await Promise.all(
    generatedList
      .filter(([, result]) => result.source === 'llm')
      .map(([sectionId, result]) =>
        cacheStore.setSection(cacheKey, sectionId, { fragment: result.value })
      )
  );

  const output = assembleOutput(cached, generated, deterministic);

  // 조립 결과에 한자/금지어/일일톤/자극어가 섞이면 통째로 deterministic 으로 교체.
  if (hasHardTotalReviewViolation(output)) {
    return {
      source: 'fallback',
      output: deterministic,
      reasons: ['hard_violation_in_assembled_output'],
      meta,
    };
  }

  const full = validateTotalReview(output, {
    relationshipStatus: input.context.relationship_status,
    occupationStatus: input.context.occupation_status,
    concern: input.context.concern,
    userName: args.userName ?? null,
  });
  // 캐시에서 온 섹션은 이미 llm 통과분이다. 새로 만든 섹션만 성패를 본다.
  const allLlm = TOTAL_REVIEW_SECTION_IDS.every(
    (sectionId) => cached[sectionId] || generated[sectionId]?.source === 'llm'
  );
  const source: 'llm' | 'fallback' = allLlm ? 'llm' : 'fallback';

  return { source, output, reasons: full.reasons, meta };
}
