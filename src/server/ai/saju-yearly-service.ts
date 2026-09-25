import { getClassicReadingGrounding, readingGroundingFingerprint } from '@/server/classics/reading-grounding';
import {
  buildYearlyReport,
  type SajuInterpretationGrounding,
  type SajuYearlyReport,
} from '@/domain/saju/report';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import {
  normalizeMoonlightCounselor,
  resolveMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { getUserProfileById } from '@/lib/profile';
import { getRecentFortuneFeedbackSummary } from '@/lib/fortune-feedback';
import { isReadingId, resolveReading } from '@/lib/saju/readings';
import { buildSajuReportRuntimeMetadata, type SajuReportRuntimeMetadata } from '@/lib/saju/report-metadata';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  buildFallbackYearlyInterpretation,
  buildFallbackYearlyNarrativeInterpretation,
  createYearlyInterpretationPrompt,
  getYearlyInterpretationPromptVersion,
  mergeYearlyInterpretationSections,
  parseYearlyMonthlyFlowsText,
  parseYearlyNarrativeInterpretationText,
  renderYearlyInterpretationReport,
  buildFallbackNewYearExtras,
  parseNewYearExtrasText,
  SAJU_NEW_YEAR_EXTRAS_PROMPT_VERSION,
  type SajuNewYearExtras,
  type SajuYearlyAiInterpretation,
} from '@/server/ai/saju-yearly-interpretation';
import {
  generateAiText,
  getOpenAIInterpretationModel,
  type AiFallbackReason,
  type AiGenerationSource,
} from '@/server/ai/openai-text';
import { recordLlmRun } from '@/server/ai/llm-telemetry';

export type YearlyCacheKeyType = 'reading_id' | 'reading_slug' | 'unavailable';
export type YearlyInterpretationStageKey = 'narrative' | 'monthly';

interface CachedYearlyInterpretationRow {
  interpretation_json: SajuYearlyAiInterpretation;
  model: string | null;
  source: AiGenerationSource;
  fallback_reason: AiFallbackReason | null;
  error_message: string | null;
  updated_at: string;
}

export interface YearlyGenerationStageResult {
  key: YearlyInterpretationStageKey;
  source: AiGenerationSource;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
  durationMs: number;
}

export interface GenerateYearlyInterpretationRequest {
  readingIdentifier: string;
  targetYear: number;
  counselorId?: MoonlightCounselorId | null;
  regenerate?: boolean;
  getClassicGrounding?: typeof getClassicReadingGrounding;
  /** 2026-09-26 — 신년운세 부가 필드(가족·학업·분기·기대/조심) 생성 여부. route 가 full 티어일 때만 true. */
  includeNewYear?: boolean;
  /** 테스트 주입용 캐시. 기본은 ai_yearly_interpretations 테이블. */
  cacheStore?: YearlyCacheStore;
}

type CacheWriteInput = Parameters<typeof writeCachedInterpretation>[0];

export interface YearlyCacheStore {
  read: typeof readCachedInterpretation;
  write: (input: CacheWriteInput) => Promise<void>;
}

const supabaseYearlyCacheStore: YearlyCacheStore = {
  read: (...args) => readCachedInterpretation(...args),
  write: (input) => writeCachedInterpretation(input),
};

// 테스트용 — 키 = 식별자·연도·상담사·버전. openai 결과만 쓴다(기본 저장소와 같은 규칙).
export function createInMemoryYearlyCacheStore(): YearlyCacheStore {
  const rows = new Map<string, CachedYearlyInterpretationRow>();
  const keyOf = (key: CacheKeyParts, year: number, counselor: string, version: string) =>
    `${key.readingId ?? key.readingSlug}|${year}|${counselor}|${version}`;
  return {
    read: async (key, year, counselor, version) => rows.get(keyOf(key, year, counselor, version)) ?? null,
    write: async (input) => {
      if (input.source !== 'openai') return;
      rows.set(keyOf(input.key, input.targetYear, input.counselorId, input.promptVersion), {
        interpretation_json: input.interpretation,
        model: input.model,
        source: input.source,
        fallback_reason: input.fallbackReason,
        error_message: input.errorMessage,
        updated_at: new Date().toISOString(),
      });
    },
  };
}

export interface YearlyInterpretationResponsePayload {
  ok: true;
  readingId: string;
  resolvedReadingId: string;
  readingSource: 'database-reading-id' | 'deterministic-slug';
  targetYear: number;
  counselorId: MoonlightCounselorId;
  promptVersion: string;
  metadata: SajuReportRuntimeMetadata;
  cached: boolean;
  cacheable: boolean;
  cacheKeyType: YearlyCacheKeyType;
  source: AiGenerationSource;
  model: string | null;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
  generationMs: number;
  updatedAt?: string;
  grounding: SajuInterpretationGrounding;
  kasiComparison: KasiSingleInputComparison | null;
  interpretation: SajuYearlyAiInterpretation;
  report: SajuYearlyReport;
  reportText: string;
  stageResults: YearlyGenerationStageResult[];
}

interface CacheKeyParts {
  cacheKeyType: YearlyCacheKeyType;
  readingId: string | null;
  readingSlug: string | null;
}

const YEARLY_NARRATIVE_TIMEOUT_MS = 32_000;
const YEARLY_MONTHLY_TIMEOUT_MS = 28_000;
const YEARLY_NARRATIVE_OUTPUT_TOKENS = 2400;
const YEARLY_MONTHLY_OUTPUT_TOKENS = 1900;
const YEARLY_NEW_YEAR_TIMEOUT_MS = 30_000;
const YEARLY_NEW_YEAR_OUTPUT_TOKENS = 1800;

async function runTimedAiStage<T extends { source: AiGenerationSource; fallbackReason: AiFallbackReason | null; errorMessage: string | null }>(
  task: Promise<T>
) {
  const startedAt = Date.now();
  const result = await task;

  return {
    result,
    durationMs: Date.now() - startedAt,
  };
}

function buildCacheKeyParts(identifier: string): CacheKeyParts {
  if (isReadingId(identifier)) {
    return {
      cacheKeyType: 'reading_id',
      readingId: identifier,
      readingSlug: null,
    };
  }

  if (identifier.trim().length > 0) {
    return {
      cacheKeyType: 'reading_slug',
      readingId: null,
      readingSlug: identifier.trim(),
    };
  }

  return {
    cacheKeyType: 'unavailable',
    readingId: null,
    readingSlug: null,
  };
}

async function readCachedInterpretation(
  key: CacheKeyParts,
  targetYear: number,
  counselorId: MoonlightCounselorId,
  promptVersion: string
) {
  if (!hasSupabaseServiceEnv || key.cacheKeyType === 'unavailable') return null;

  try {
    const supabase = await createServiceClient();
    let query = supabase
      .from('ai_yearly_interpretations')
      .select('interpretation_json, model, source, fallback_reason, error_message, updated_at')
      .eq('target_year', targetYear)
      .eq('counselor_id', counselorId)
      .eq('prompt_version', promptVersion);

    query =
      key.cacheKeyType === 'reading_id'
        ? query.eq('reading_id', key.readingId)
        : query.eq('reading_slug', key.readingSlug);

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as CachedYearlyInterpretationRow;
  } catch {
    return null;
  }
}

async function writeCachedInterpretation(input: {
  key: CacheKeyParts;
  targetYear: number;
  counselorId: MoonlightCounselorId;
  interpretation: SajuYearlyAiInterpretation;
  promptVersion: string;
  model: string | null;
  source: AiGenerationSource;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
}) {
  if (!hasSupabaseServiceEnv || input.key.cacheKeyType === 'unavailable') return;
  if (input.source !== 'openai') return;

  const promptVersion = input.promptVersion;
  const row = {
    reading_id: input.key.readingId,
    reading_slug: input.key.readingSlug,
    target_year: input.targetYear,
    counselor_id: input.counselorId,
    prompt_version: promptVersion,
    interpretation_json: input.interpretation,
    model: input.model,
    source: input.source,
    fallback_reason: input.fallbackReason,
    error_message: input.errorMessage,
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = await createServiceClient();
    await supabase.from('ai_yearly_interpretations').upsert(row, {
      onConflict:
        input.key.cacheKeyType === 'reading_id'
          ? 'reading_id,target_year,counselor_id,prompt_version'
          : 'reading_slug,target_year,counselor_id,prompt_version',
    });
  } catch {
    // Cache writes must never block the user-facing response.
  }
}

// 신년운세 부가 단계. 실패하면 결정론 폴백(빈 섹션을 보여 주지 않는다).
async function generateNewYearExtras(
  reading: NonNullable<Awaited<ReturnType<typeof resolveReading>>>,
  report: SajuYearlyReport,
  counselorId: MoonlightCounselorId,
  recentFeedbackSummary: string | null,
  classicGrounding: Awaited<ReturnType<typeof getClassicReadingGrounding>>
): Promise<SajuNewYearExtras> {
  const fallback = buildFallbackNewYearExtras(report);
  const prompt = createYearlyInterpretationPrompt(reading, report, counselorId, 'newyear', recentFeedbackSummary, classicGrounding);
  const result = await generateAiText({
    ...prompt,
    fallbackText: JSON.stringify(fallback),
    model: getOpenAIInterpretationModel(),
    maxOutputTokens: YEARLY_NEW_YEAR_OUTPUT_TOKENS,
    timeoutMs: YEARLY_NEW_YEAR_TIMEOUT_MS,
    feature: 'yearly',
    userId: reading.userId,
  });
  const parsed = parseNewYearExtrasText(result.text, fallback);
  // 성공했을 때만 버전을 찍는다 — 폴백이 캐시에 굳으면 결제한 사람이 영원히 폴백을 본다(다음 열람에서 다시 시도).
  return result.source === 'openai' && parsed.ok
    ? { ...parsed.extras, _version: SAJU_NEW_YEAR_EXTRAS_PROMPT_VERSION }
    : parsed.extras;
}

export async function generateYearlyInterpretation(
  request: GenerateYearlyInterpretationRequest
): Promise<YearlyInterpretationResponsePayload | null> {
  const reading = await resolveReading(request.readingIdentifier);
  if (!reading) return null;

  const startedAt = Date.now();
  const readingSource = isReadingId(request.readingIdentifier)
    ? 'database-reading-id'
    : 'deterministic-slug';
  const cacheKey = buildCacheKeyParts(request.readingIdentifier);
  const storedCounselor =
    reading.userId && hasSupabaseServiceEnv
      ? (await getUserProfileById(reading.userId)).preferredCounselor
      : null;
  const counselorId = resolveMoonlightCounselor(
    normalizeMoonlightCounselor(request.counselorId) ?? undefined,
    storedCounselor
  );
  const classicGrounding = await (request.getClassicGrounding ?? getClassicReadingGrounding)(reading.sajuData, 'yearly');
  const promptVersion = `${getYearlyInterpretationPromptVersion(counselorId)}|${readingGroundingFingerprint(classicGrounding)}`;
  const cacheStore = request.cacheStore ?? supabaseYearlyCacheStore;
  const cacheable =
    (request.cacheStore ? true : hasSupabaseServiceEnv) && cacheKey.cacheKeyType !== 'unavailable';
  const recentFeedbackSummary =
    reading.userId && hasSupabaseServiceEnv
      ? await getRecentFortuneFeedbackSummary(reading.userId)
      : null;

  if (cacheable && !request.regenerate) {
    const cached = await cacheStore.read(cacheKey, request.targetYear, counselorId, promptVersion);
    if (cached) {
      // 2026-09-26 — basic 이 먼저 만든 행(또는 옛 부가 버전)에 full 요청이 오면 부가 단계만 만들어 붙인다.
      //   narrative·monthly 는 다시 만들지 않는다(비용·문장 일관성).
      if (request.includeNewYear && cached.interpretation_json.newYear?._version !== SAJU_NEW_YEAR_EXTRAS_PROMPT_VERSION) {
        const newYear = await generateNewYearExtras(
          reading,
          buildYearlyReport(reading.input, reading.sajuData, request.targetYear),
          counselorId,
          recentFeedbackSummary,
          classicGrounding
        );
        cached.interpretation_json = { ...cached.interpretation_json, newYear };
        await cacheStore.write({
          promptVersion,
          key: cacheKey,
          targetYear: request.targetYear,
          counselorId,
          interpretation: cached.interpretation_json,
          model: cached.model,
          source: cached.source,
          fallbackReason: cached.fallback_reason,
          errorMessage: cached.error_message,
        });
      }
      await recordLlmRun({ feature: 'yearly', source: 'cache', model: cached.model, userId: reading.userId });
      return {
        ok: true,
        readingId: request.readingIdentifier,
        resolvedReadingId: reading.id,
        readingSource,
        targetYear: request.targetYear,
        counselorId,
        promptVersion,
        metadata: buildSajuReportRuntimeMetadata(reading.metadata, {
          promptVersion,
          llmModel: cached.model,
          generationSource: cached.source,
        }),
        cached: true,
        cacheable,
        cacheKeyType: cacheKey.cacheKeyType,
        source: cached.source,
        model: cached.model,
        fallbackReason: cached.fallback_reason,
        errorMessage: cached.error_message,
        generationMs: 0,
        updatedAt: cached.updated_at,
        grounding: reading.grounding,
        kasiComparison: reading.kasiComparison,
        interpretation: cached.interpretation_json,
        report: buildYearlyReport(reading.input, reading.sajuData, request.targetYear),
        reportText: renderYearlyInterpretationReport(cached.interpretation_json),
        stageResults: [],
      };
    }
  }

  const yearlyReport = buildYearlyReport(reading.input, reading.sajuData, request.targetYear);
  const fallback = buildFallbackYearlyInterpretation(yearlyReport, counselorId);
  const fallbackNarrative = buildFallbackYearlyNarrativeInterpretation(fallback);
  const fallbackMonthly = fallback.monthlyFlows;
  const model = getOpenAIInterpretationModel();

  const narrativePrompt = createYearlyInterpretationPrompt(
    reading,
    yearlyReport,
    counselorId,
    'narrative',
    recentFeedbackSummary,
    classicGrounding
  );
  const monthlyPrompt = createYearlyInterpretationPrompt(
    reading,
    yearlyReport,
    counselorId,
    'monthly',
    recentFeedbackSummary,
    classicGrounding
  );

  const newYearTask = request.includeNewYear
    ? generateNewYearExtras(reading, yearlyReport, counselorId, recentFeedbackSummary, classicGrounding)
    : Promise.resolve(undefined);
  const [narrativeStage, monthlyStage, newYear] = await Promise.all([
    runTimedAiStage(
      generateAiText({
        ...narrativePrompt,
        fallbackText: JSON.stringify(fallbackNarrative),
        model,
        maxOutputTokens: YEARLY_NARRATIVE_OUTPUT_TOKENS,
        timeoutMs: YEARLY_NARRATIVE_TIMEOUT_MS,
        feature: 'yearly',
        userId: reading.userId,
      })
    ),
    runTimedAiStage(
      generateAiText({
        ...monthlyPrompt,
        fallbackText: JSON.stringify({ monthlyFlows: fallbackMonthly }),
        model,
        maxOutputTokens: YEARLY_MONTHLY_OUTPUT_TOKENS,
        timeoutMs: YEARLY_MONTHLY_TIMEOUT_MS,
        feature: 'yearly',
        userId: reading.userId,
      })
    ),
    newYearTask,
  ]);
  const narrativeResult = narrativeStage.result;
  const monthlyResult = monthlyStage.result;

  const narrativeParsed = parseYearlyNarrativeInterpretationText(
    narrativeResult.text,
    fallbackNarrative
  );
  const monthlyParsed = parseYearlyMonthlyFlowsText(
    monthlyResult.text,
    fallbackMonthly
  );

  const interpretation: SajuYearlyAiInterpretation = {
    ...mergeYearlyInterpretationSections(narrativeParsed.interpretation, monthlyParsed.monthlyFlows),
    ...(newYear ? { newYear } : {}),
  };
  const stageResults: YearlyGenerationStageResult[] = [
    {
      key: 'narrative',
      source:
        narrativeResult.source === 'openai' && narrativeParsed.ok ? 'openai' : 'fallback',
      fallbackReason:
        narrativeResult.source === 'openai' && narrativeParsed.ok
          ? null
          : narrativeResult.fallbackReason ?? 'empty_ai_response',
      errorMessage:
        narrativeResult.source === 'openai' && narrativeParsed.ok
          ? null
          : narrativeResult.errorMessage ?? narrativeParsed.errorMessage,
      durationMs: narrativeStage.durationMs,
    },
    {
      key: 'monthly',
      source: monthlyResult.source === 'openai' && monthlyParsed.ok ? 'openai' : 'fallback',
      fallbackReason:
        monthlyResult.source === 'openai' && monthlyParsed.ok
          ? null
          : monthlyResult.fallbackReason ?? 'empty_ai_response',
      errorMessage:
        monthlyResult.source === 'openai' && monthlyParsed.ok
          ? null
          : monthlyResult.errorMessage ?? monthlyParsed.errorMessage,
      durationMs: monthlyStage.durationMs,
    },
  ];

  const allStagesOpenAi = stageResults.every((stage) => stage.source === 'openai');
  const source: AiGenerationSource = allStagesOpenAi ? 'openai' : 'fallback';
  const fallbackReason =
    source === 'fallback'
      ? stageResults.find((stage) => stage.fallbackReason)?.fallbackReason ?? 'openai_error'
      : null;
  const errorMessage =
    source === 'fallback'
      ? stageResults.find((stage) => stage.errorMessage)?.errorMessage ?? null
      : null;

  await cacheStore.write({
    promptVersion,
    key: cacheKey,
    targetYear: request.targetYear,
    counselorId,
    interpretation,
    model,
    source,
    fallbackReason,
    errorMessage,
  });

  return {
    ok: true,
    readingId: request.readingIdentifier,
    resolvedReadingId: reading.id,
    readingSource,
    targetYear: request.targetYear,
    counselorId,
    promptVersion,
    metadata: buildSajuReportRuntimeMetadata(reading.metadata, {
      promptVersion,
      llmModel: model,
      generationSource: source,
    }),
    cached: false,
    cacheable,
    cacheKeyType: cacheKey.cacheKeyType,
    source,
    model,
    fallbackReason,
    errorMessage,
    generationMs: Date.now() - startedAt,
    updatedAt: new Date().toISOString(),
    grounding: reading.grounding,
    kasiComparison: reading.kasiComparison,
    interpretation,
    report: yearlyReport,
    reportText: renderYearlyInterpretationReport(interpretation),
    stageResults,
  };
}
