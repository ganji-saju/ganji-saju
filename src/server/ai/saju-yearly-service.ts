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
  counselorId: MoonlightCounselorId
) {
  if (!hasSupabaseServiceEnv || key.cacheKeyType === 'unavailable') return null;
  const promptVersion = getYearlyInterpretationPromptVersion(counselorId);

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
  model: string | null;
  source: AiGenerationSource;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
}) {
  if (!hasSupabaseServiceEnv || input.key.cacheKeyType === 'unavailable') return;
  if (input.source !== 'openai') return;

  const promptVersion = getYearlyInterpretationPromptVersion(input.counselorId);
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
  const promptVersion = getYearlyInterpretationPromptVersion(counselorId);
  const cacheable = hasSupabaseServiceEnv && cacheKey.cacheKeyType !== 'unavailable';
  const recentFeedbackSummary =
    reading.userId && hasSupabaseServiceEnv
      ? await getRecentFortuneFeedbackSummary(reading.userId)
      : null;

  if (cacheable && !request.regenerate) {
    const cached = await readCachedInterpretation(cacheKey, request.targetYear, counselorId);
    if (cached) {
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
    recentFeedbackSummary
  );
  const monthlyPrompt = createYearlyInterpretationPrompt(
    reading,
    yearlyReport,
    counselorId,
    'monthly',
    recentFeedbackSummary
  );

  const [narrativeStage, monthlyStage] = await Promise.all([
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

  const interpretation = mergeYearlyInterpretationSections(
    narrativeParsed.interpretation,
    monthlyParsed.monthlyFlows
  );
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

  await writeCachedInterpretation({
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
