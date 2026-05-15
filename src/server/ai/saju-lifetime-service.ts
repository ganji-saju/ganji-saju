import { buildLifetimeReport, type SajuInterpretationGrounding } from '@/domain/saju/report';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import {
  normalizeMoonlightCounselor,
  resolveMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { getUserProfileById } from '@/lib/profile';
import { getRecentFortuneFeedbackSummary } from '@/lib/fortune-feedback';
import { isReadingId, resolveReading, type ReadingRecord } from '@/lib/saju/readings';
import { buildSajuReportRuntimeMetadata, type SajuReportRuntimeMetadata } from '@/lib/saju/report-metadata';
import {
  buildFallbackLifetimeInterpretation,
  createLifetimeInterpretationPrompt,
  getLifetimeInterpretationPromptVersion,
  parseLifetimeInterpretationText,
  renderLifetimeInterpretationReport,
  type SajuLifetimeAiInterpretation,
} from '@/server/ai/saju-lifetime-interpretation';
import {
  generateAiText,
  getOpenAIInterpretationModel,
  type AiFallbackReason,
  type AiGenerationSource,
} from '@/server/ai/openai-text';

export interface GenerateLifetimeInterpretationRequest {
  readingIdentifier: string;
  targetYear: number;
  counselorId?: MoonlightCounselorId | null;
  regenerate?: boolean;
  readingRecord?: ReadingRecord | null;
}

export interface LifetimeGenerationStageResult {
  key: 'full';
  source: AiGenerationSource;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
  durationMs: number;
}

export interface LifetimeInterpretationResponsePayload {
  ok: true;
  readingId: string;
  resolvedReadingId: string;
  readingSource: 'database-reading-id' | 'deterministic-slug';
  targetYear: number;
  counselorId: MoonlightCounselorId;
  promptVersion: string;
  metadata: SajuReportRuntimeMetadata;
  cached: false;
  cacheable: false;
  source: AiGenerationSource;
  model: string | null;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
  generationMs: number;
  grounding: SajuInterpretationGrounding;
  kasiComparison: KasiSingleInputComparison | null;
  interpretation: SajuLifetimeAiInterpretation;
  report: ReturnType<typeof buildLifetimeReport>;
  reportText: string;
  stageResults: LifetimeGenerationStageResult[];
}

const LIFETIME_TIMEOUT_MS = 38_000;
const LIFETIME_OUTPUT_TOKENS = 2600;

export async function generateLifetimeInterpretation(
  request: GenerateLifetimeInterpretationRequest
): Promise<LifetimeInterpretationResponsePayload | null> {
  const reading = request.readingRecord ?? (await resolveReading(request.readingIdentifier));
  if (!reading) return null;

  const startedAt = Date.now();
  const readingSource = isReadingId(request.readingIdentifier)
    ? 'database-reading-id'
    : 'deterministic-slug';
  const storedCounselor = reading.userId
    ? (await getUserProfileById(reading.userId)).preferredCounselor
    : null;
  const counselorId = resolveMoonlightCounselor(
    normalizeMoonlightCounselor(request.counselorId) ?? undefined,
    storedCounselor
  );
  const promptVersion = getLifetimeInterpretationPromptVersion(counselorId);
  // 2026-05-15 PR 2: 사용자 현재 상황을 grounding 의 personalizationContext 에서 추출해
  // buildLifetimeReport 로 흘려, 대운 cycle 8단의 hook/relationship/wealthCareer 분기에 사용.
  const userSituation = reading.grounding.personalizationContext.userSituation ?? null;
  const report = buildLifetimeReport(reading.input, reading.sajuData, request.targetYear, userSituation);
  const fallback = buildFallbackLifetimeInterpretation(report, counselorId);
  const model = getOpenAIInterpretationModel();
  const recentFeedbackSummary = reading.userId
    ? await getRecentFortuneFeedbackSummary(reading.userId)
    : null;
  const prompt = createLifetimeInterpretationPrompt(
    reading,
    report,
    counselorId,
    recentFeedbackSummary
  );

  const stageStartedAt = Date.now();
  const aiResult = await generateAiText({
    ...prompt,
    fallbackText: JSON.stringify(fallback),
    model,
    maxOutputTokens: LIFETIME_OUTPUT_TOKENS,
    timeoutMs: LIFETIME_TIMEOUT_MS,
  });
  const parsed = parseLifetimeInterpretationText(aiResult.text, fallback);
  const interpretation =
    aiResult.source === 'openai' && parsed.ok ? parsed.interpretation : fallback;
  const source: AiGenerationSource =
    aiResult.source === 'openai' && parsed.ok ? 'openai' : 'fallback';
  const fallbackReason =
    source === 'openai' ? null : aiResult.fallbackReason ?? 'empty_ai_response';
  const errorMessage =
    source === 'openai' ? null : aiResult.errorMessage ?? parsed.errorMessage;
  const reportText = renderLifetimeInterpretationReport(interpretation, report);

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
      llmModel: aiResult.model,
      generationSource: source,
    }),
    cached: false,
    cacheable: false,
    source,
    model: aiResult.model,
    fallbackReason,
    errorMessage,
    generationMs: Date.now() - startedAt,
    grounding: reading.grounding,
    kasiComparison: reading.kasiComparison,
    interpretation,
    report,
    reportText,
    stageResults: [
      {
        key: 'full',
        source,
        fallbackReason,
        errorMessage,
        durationMs: Date.now() - stageStartedAt,
      },
    ],
  };
}
