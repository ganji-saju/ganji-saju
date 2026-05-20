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
import type { TotalReviewOutput } from './total-review/total-review-types';

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
}

export interface TotalReviewResult {
  /** llm = 3섹션 모두 LLM 통과 / fallback = 플래그 OFF·hard 위반·일부 섹션 실패 */
  source: 'llm' | 'fallback';
  output: TotalReviewOutput;
  /** validateTotalReview 의 reasons (soft 포함, 로깅용) */
  reasons: string[];
  meta: { generatedAt: string; cacheKey: string; modelVersion: string };
}

// main_narrative(4단락 5~8문장)가 가장 큼 — 넉넉히. 작은 섹션은 조기 종료.
const TOTAL_REVIEW_MAX_OUTPUT_TOKENS = 1500;

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
  });
  const meta = {
    generatedAt: now.toISOString(),
    cacheKey,
    modelVersion: TOTAL_REVIEW_PROMPT_VERSION,
  };

  if (!isTotalReviewLLMEnabled(env)) {
    return { source: 'fallback', output: deterministic, reasons: ['llm_disabled'], meta };
  }

  const input = buildTotalReviewInput(args.sajuData, args.personalizationContext, {
    userName: args.userName ?? null,
    gender: args.gender ?? null,
    now,
  });
  const client =
    args.client ??
    createOpenAITotalReviewClient({ maxOutputTokens: TOTAL_REVIEW_MAX_OUTPUT_TOKENS });
  const maxRetries = args.maxRetries ?? 2;

  const [oneLine, main, keys] = await Promise.all([
    generateTotalReviewSection('one_line_summary', input, client, {
      maxRetries,
      fallback: { one_line_summary: deterministic.one_line_summary },
    }),
    generateTotalReviewSection('main_narrative', input, client, {
      maxRetries,
      fallback: { main_narrative: deterministic.main_narrative },
    }),
    generateTotalReviewSection('lifetime_keys', input, client, {
      maxRetries,
      fallback: { lifetime_keys: deterministic.lifetime_keys },
    }),
  ]);

  const output: TotalReviewOutput = {
    one_line_summary: oneLine.value.one_line_summary,
    main_narrative: main.value.main_narrative,
    lifetime_keys: keys.value.lifetime_keys,
  };

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
  const allLlm =
    oneLine.source === 'llm' && main.source === 'llm' && keys.source === 'llm';

  return {
    source: allLlm ? 'llm' : 'fallback',
    output,
    reasons: full.reasons,
    meta,
  };
}
