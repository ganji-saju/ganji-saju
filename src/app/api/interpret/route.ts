import { NextRequest, NextResponse } from 'next/server';
import {
  buildSajuInterpretationGrounding,
  buildInterpretSajuDataSnapshot,
  buildSajuDataCacheHash,
  buildSajuReport,
  isSameInterpretSajuDataSnapshot,
  normalizeInterpretSajuDataSnapshot,
  normalizeFocusTopic,
  type InterpretSajuDataSnapshot,
} from '@/domain/saju/report';
import {
  normalizeMoonlightCounselor,
  resolveMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { getUserProfileById } from '@/lib/profile';
import { getRecentFortuneFeedbackSummary } from '@/lib/fortune-feedback';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { isReadingId, resolveReading } from '@/lib/saju/readings';
import { buildSajuReportRuntimeMetadata } from '@/lib/saju/report-metadata';
import {
  buildFallbackInterpretation,
  createInterpretationPrompt,
  getInterpretationPromptVersion,
  parseInterpretationText,
  type SajuAiInterpretation,
} from '@/server/ai/saju-interpretation';
import {
  generateAiText,
  getOpenAIInterpretationModel,
  type AiFallbackReason,
  type AiGenerationSource,
} from '@/server/ai/openai-text';

export const runtime = 'nodejs';
export const maxDuration = 25;

interface InterpretRequest {
  readingId: string;
  topic?: string;
  regenerate?: boolean;
  counselorId?: MoonlightCounselorId;
  profileId?: string;
  sajuData?: InterpretSajuDataSnapshot;
  sajuDataHash?: string;
}

interface CachedInterpretationRow {
  interpretation_json: SajuAiInterpretation;
  model: string | null;
  source: AiGenerationSource;
  fallback_reason: AiFallbackReason | null;
  error_message: string | null;
  updated_at: string;
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseInterpretRequest(payload: unknown): InterpretRequest | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const readingId = readString(data, 'readingId');
  if (!readingId) return null;

  return {
    readingId,
    topic: readString(data, 'topic') || undefined,
    regenerate: data.regenerate === true,
    counselorId: normalizeMoonlightCounselor(data.counselorId) ?? undefined,
    profileId: readString(data, 'profileId') || undefined,
    sajuData: normalizeInterpretSajuDataSnapshot(data.sajuData) ?? undefined,
    sajuDataHash: readString(data, 'sajuDataHash') || undefined,
  };
}

async function readCachedInterpretation(
  readingId: string,
  topic: string,
  counselorId: MoonlightCounselorId
) {
  if (!hasSupabaseServiceEnv || !isReadingId(readingId)) return null;
  const promptVersion = getInterpretationPromptVersion(counselorId);

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('ai_interpretations')
      .select('interpretation_json, model, source, fallback_reason, error_message, updated_at')
      .eq('reading_id', readingId)
      .eq('topic', topic)
      .eq('prompt_version', promptVersion)
      .maybeSingle();

    if (error || !data) return null;
    return data as CachedInterpretationRow;
  } catch {
    return null;
  }
}

async function writeCachedInterpretation(input: {
  readingId: string;
  topic: string;
  counselorId: MoonlightCounselorId;
  interpretation: SajuAiInterpretation;
  model: string | null;
  source: AiGenerationSource;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
}) {
  if (!hasSupabaseServiceEnv || !isReadingId(input.readingId)) return;
  if (input.source !== 'openai') return;
  const promptVersion = getInterpretationPromptVersion(input.counselorId);

  try {
    const supabase = await createServiceClient();
    await supabase.from('ai_interpretations').upsert(
      {
        reading_id: input.readingId,
        topic: input.topic,
        prompt_version: promptVersion,
        interpretation_json: input.interpretation,
        model: input.model,
        source: input.source,
        fallback_reason: input.fallbackReason,
        error_message: input.errorMessage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'reading_id,topic,prompt_version' }
    );
  } catch {
    // Cache writes must never break the user-facing interpretation response.
  }
}

export async function POST(req: NextRequest) {
  const parsed = parseInterpretRequest(await req.json().catch(() => null));

  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: 'readingId가 필요합니다.' },
      { status: 400 }
    );
  }

  const reading = await resolveReading(parsed.readingId);

  if (!reading) {
    return NextResponse.json(
      { ok: false, error: '사주 결과를 찾지 못했습니다.' },
      { status: 404 }
    );
  }

  const sajuDataSnapshot = buildInterpretSajuDataSnapshot(reading.input, reading.sajuData);
  const sajuDataHash = buildSajuDataCacheHash(reading.input, reading.sajuData);

  if (parsed.sajuDataHash && parsed.sajuDataHash !== sajuDataHash) {
    return NextResponse.json(
      {
        ok: false,
        error: '사주 계산 데이터가 현재 결과와 맞지 않습니다. 새로 풀이를 생성해 주세요.',
        code: 'saju_data_hash_mismatch',
        expectedSajuDataHash: sajuDataHash,
      },
      { status: 409 }
    );
  }

  if (parsed.sajuData && !isSameInterpretSajuDataSnapshot(parsed.sajuData, sajuDataSnapshot)) {
    return NextResponse.json(
      {
        ok: false,
        error: '사주 계산 데이터가 현재 결과와 맞지 않습니다. 새로 풀이를 생성해 주세요.',
        code: 'saju_data_snapshot_mismatch',
        expectedSajuDataHash: sajuDataHash,
      },
      { status: 409 }
    );
  }

  const topic = normalizeFocusTopic(parsed.topic);
  const cacheable = isReadingId(parsed.readingId);
  const storedCounselor =
    reading.userId && hasSupabaseServiceEnv
      ? (await getUserProfileById(reading.userId)).preferredCounselor
      : null;
  const counselorId = resolveMoonlightCounselor(parsed.counselorId, storedCounselor);
  const recentFeedbackSummary =
    reading.userId && hasSupabaseServiceEnv
      ? await getRecentFortuneFeedbackSummary(reading.userId)
      : null;

  if (cacheable && !parsed.regenerate) {
    const cached = await readCachedInterpretation(parsed.readingId, topic, counselorId);
    if (cached) {
      return NextResponse.json({
        ok: true,
        readingId: parsed.readingId,
        topic,
        counselorId,
        cached: true,
        cacheable,
        source: cached.source,
        model: cached.model,
        sajuDataHash,
        sajuDataSnapshot,
        fallbackReason: cached.fallback_reason,
        errorMessage: cached.error_message,
        metadata: buildSajuReportRuntimeMetadata(reading.metadata, {
          promptVersion: getInterpretationPromptVersion(counselorId),
          llmModel: cached.model,
          generationSource: cached.source,
        }),
        interpretation: cached.interpretation_json,
        updatedAt: cached.updated_at,
      });
    }
  }

  const report = buildSajuReport(reading.input, reading.sajuData, topic);
  const grounding =
    topic === 'today'
      ? reading.grounding
      : buildSajuInterpretationGrounding(reading.input, reading.sajuData, report);
  const fallback = buildFallbackInterpretation(report, counselorId, grounding);
  const prompt = createInterpretationPrompt(
    grounding,
    {
      topic: report.focusTopic,
      label: report.focusLabel,
      scoreKey: report.focusScoreKey,
    },
    counselorId,
    recentFeedbackSummary
  );
  const model = getOpenAIInterpretationModel();
  const aiResult = await generateAiText({
    ...prompt,
    fallbackText: JSON.stringify(fallback),
    model,
    maxOutputTokens: 900,
    temperature: 0.7,
  });
  const parsedInterpretation = parseInterpretationText(aiResult.text, fallback);
  const source: AiGenerationSource =
    aiResult.source === 'openai' && parsedInterpretation.ok ? 'openai' : 'fallback';
  const fallbackReason =
    source === 'fallback' ? aiResult.fallbackReason ?? 'empty_ai_response' : null;
  const errorMessage =
    source === 'fallback'
      ? aiResult.errorMessage ?? parsedInterpretation.errorMessage
      : null;

  await writeCachedInterpretation({
    readingId: parsed.readingId,
    topic,
    counselorId,
    interpretation: parsedInterpretation.interpretation,
    model: aiResult.model,
    source,
    fallbackReason,
    errorMessage,
  });

  return NextResponse.json({
    ok: true,
    readingId: parsed.readingId,
    topic,
    counselorId,
    cached: false,
    cacheable,
    source,
    model: aiResult.model,
    sajuDataHash,
    sajuDataSnapshot,
    fallbackReason,
    errorMessage,
    metadata: buildSajuReportRuntimeMetadata(reading.metadata, {
      promptVersion: getInterpretationPromptVersion(counselorId),
      llmModel: aiResult.model,
      generationSource: source,
    }),
    interpretation: parsedInterpretation.interpretation,
  });
}
