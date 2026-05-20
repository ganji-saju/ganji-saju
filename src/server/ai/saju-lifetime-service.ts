import { buildLifetimeReport, type SajuInterpretationGrounding } from '@/domain/saju/report';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import {
  normalizeMoonlightCounselor,
  resolveMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { getUserProfileById } from '@/lib/profile';
import { getRecentFortuneFeedbackSummary } from '@/lib/fortune-feedback';
import {
  isReadingId,
  resolveReading,
  updateReadingChapters,
  type ReadingRecord,
} from '@/lib/saju/readings';
import { buildSajuReportRuntimeMetadata, type SajuReportRuntimeMetadata } from '@/lib/saju/report-metadata';
// V2-5 PR I: 챕터 1 (타고난 성향) LLM enhancement 통합.
//   audit-reports/2026-05-19-v2-5-llm-integration-design.md 의 PR I 구현.
import { enhanceLifetimeChapter1WithLLM } from './chapters/enhance-lifetime-chapter1';
import { buildChapter1Input } from './chapters/build-chapter1-input';
// V2-5 PR J: 챕터 4 (관계 패턴) + 챕터 5 (재물 감각) LLM enhancement 통합.
//   PR I 와 동일 패턴. interpretLifetime 안에서 chain 으로 순차 적용.
import { enhanceLifetimeChapter4WithLLM } from './chapters/enhance-lifetime-chapter4';
import { buildChapter4Input } from './chapters/build-chapter4-input';
import { enhanceLifetimeChapter5WithLLM } from './chapters/enhance-lifetime-chapter5';
import { buildChapter5Input } from './chapters/build-chapter5-input';
import { OpenAIChapterClient } from './chapters/openai-chapter-client';
import {
  buildChapterCacheKey,
  isChapterCacheFresh,
  isChapterLLMEnabled,
} from './chapters/chapter-cache';
import { logChapterRun } from './chapters/chapter-telemetry';
import {
  PERSISTED_CHAPTER_ENVELOPE_V1,
  type PersistedChapterEntry,
  type PersistedChapterEnvelope,
} from './chapters/chapter-storage-types';
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
  const baseReport = buildLifetimeReport(reading.input, reading.sajuData, request.targetYear, userSituation);
  const model = getOpenAIInterpretationModel();
  // V2-5 PR I + PR J: 챕터 1, 4, 5 순차 LLM enhance — 각 챕터 env flag 활성 시.
  //   cache hit 이면 DB envelope 의 body 사용. miss 면 OpenAI 호출 + envelope upsert.
  //   비활성 / 실패 시 deterministic baseReport 그대로 (회귀 0 보장).
  //
  //   주의 (PR J): 동일 request 안에서 챕터 1/4/5 모두 cache miss 시 envelope
  //   upsert 는 last-write-wins (각 apply 가 reading.chaptersEnvelope 의 pre-upsert
  //   snapshot 만 봄). 결과: DB envelope 에 챕터 5 entry 만 남음. 다음 request 에서
  //   챕터 1, 4 는 다시 cache miss → LLM 재호출 → envelope 1,4,5 모두 갖춤
  //   (eventually consistent). 최대 비용 ≈ $0.005 × 2 = $0.01 1회 추가. 허용.
  let report = await applyChapter1LLMEnhancement(
    reading, baseReport, userSituation, model, promptVersion
  );
  report = await applyChapter4LLMEnhancement(
    reading, report, userSituation, model, promptVersion
  );
  report = await applyChapter5LLMEnhancement(
    reading, report, userSituation, model, promptVersion
  );
  const fallback = buildFallbackLifetimeInterpretation(report, counselorId);
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

/**
 * V2-5 PR I: 챕터 1 (코어 정체성) LLM enhancement.
 *
 * env OPENAI_INTERPRET_CHAPTERS=1 + OPENAI_INTERPRET_CHAPTER_IDS 에 1 포함 시 활성.
 * 캐시 hit (DB envelope `_chapters[1]` 가 같은 cacheKey + 30일 이내 + LLM 성공) 이면
 * 그 body 로 coreIdentity.summary 교체. 캐시 miss 면 OpenAI 호출 후 envelope upsert.
 * LLM 자체 실패 / env 비활성 시 deterministic baseReport 그대로 반환 (회귀 0 보장).
 */
async function applyChapter1LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(1)) return baseReport;

  const chapter1Input = buildChapter1Input(reading.sajuData, userSituation ?? null, {
    name: reading.input.name ?? null,
    age: null,
  });
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter1Input.userContext, 1);
  const cached = reading.chaptersEnvelope?.chapters?.[1];
  const stageStartedAt = Date.now();

  // Cache hit — DB envelope 의 body 사용.
  if (
    cached &&
    cached.cacheKey === cacheKey &&
    cached.source === 'llm' &&
    isChapterCacheFresh(cached.generatedAt)
  ) {
    logChapterRun({
      chapterId: 1,
      source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries,
      cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      coreIdentity: { ...baseReport.coreIdentity, summary: cached.body },
    };
  }

  // Cache miss — OpenAI 호출.
  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter1WithLLM(
      baseReport.coreIdentity,
      chapter1Input,
      client
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 1,
        body: enhanced.coreIdentity.summary,
        source: 'llm',
        retries: enhanced.retries as 0 | 1 | 2,
        cacheKey,
        generatedAt: new Date().toISOString(),
        validationFailures: [],
      };
      const envelope: PersistedChapterEnvelope = {
        schemaVersion: PERSISTED_CHAPTER_ENVELOPE_V1,
        generatedAt: entry.generatedAt,
        promptVersion,
        model,
        chapters: {
          ...(reading.chaptersEnvelope?.chapters ?? {}),
          1: entry,
        },
      };
      try {
        await updateReadingChapters(reading.id, envelope);
      } catch (writeError) {
        // envelope upsert 실패는 in-memory 결과 사용 + 다음 호출 시 재시도. silent.
        console.error('updateReadingChapters failed', writeError);
      }
    }

    logChapterRun({
      chapterId: 1,
      source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries,
      cacheKey,
      validationFailures: [],
    });
    return {
      ...baseReport,
      coreIdentity: enhanced.coreIdentity,
    };
  } catch (error) {
    // LLM 호출 자체 실패 (timeout, network 등) → deterministic baseReport.
    logChapterRun({
      chapterId: 1,
      source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0,
      cacheKey,
      validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}

/**
 * V2-5 PR J: 챕터 4 (관계 패턴) LLM enhancement.
 * applyChapter1LLMEnhancement 와 동일 흐름. env flag + cache + envelope upsert.
 */
async function applyChapter4LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(4)) return baseReport;

  const chapter4Input = buildChapter4Input(reading.sajuData, userSituation ?? null, {
    name: reading.input.name ?? null,
    age: null,
  });
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter4Input.userContext, 4);
  const cached = reading.chaptersEnvelope?.chapters?.[4];
  const stageStartedAt = Date.now();

  if (
    cached &&
    cached.cacheKey === cacheKey &&
    cached.source === 'llm' &&
    isChapterCacheFresh(cached.generatedAt)
  ) {
    logChapterRun({
      chapterId: 4, source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries, cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      relationshipPattern: { ...baseReport.relationshipPattern, summary: cached.body },
    };
  }

  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter4WithLLM(
      baseReport.relationshipPattern, chapter4Input, client
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 4,
        body: enhanced.relationshipPattern.summary,
        source: 'llm',
        retries: enhanced.retries as 0 | 1 | 2,
        cacheKey,
        generatedAt: new Date().toISOString(),
        validationFailures: [],
      };
      const envelope: PersistedChapterEnvelope = {
        schemaVersion: PERSISTED_CHAPTER_ENVELOPE_V1,
        generatedAt: entry.generatedAt,
        promptVersion, model,
        chapters: {
          ...(reading.chaptersEnvelope?.chapters ?? {}),
          4: entry,
        },
      };
      try {
        await updateReadingChapters(reading.id, envelope);
      } catch (writeError) {
        console.error('updateReadingChapters (ch4) failed', writeError);
      }
    }

    logChapterRun({
      chapterId: 4, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    });
    return {
      ...baseReport,
      relationshipPattern: enhanced.relationshipPattern,
    };
  } catch (error) {
    logChapterRun({
      chapterId: 4, source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0, cacheKey,
      validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}

/**
 * V2-5 PR J: 챕터 5 (재물 감각) LLM enhancement.
 * applyChapter4LLMEnhancement 와 구조 동일. wealthStyle field 만 교체.
 */
async function applyChapter5LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(5)) return baseReport;

  const chapter5Input = buildChapter5Input(reading.sajuData, userSituation ?? null, {
    name: reading.input.name ?? null,
    age: null,
  });
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter5Input.userContext, 5);
  const cached = reading.chaptersEnvelope?.chapters?.[5];
  const stageStartedAt = Date.now();

  if (
    cached &&
    cached.cacheKey === cacheKey &&
    cached.source === 'llm' &&
    isChapterCacheFresh(cached.generatedAt)
  ) {
    logChapterRun({
      chapterId: 5, source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries, cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      wealthStyle: { ...baseReport.wealthStyle, summary: cached.body },
    };
  }

  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter5WithLLM(
      baseReport.wealthStyle, chapter5Input, client
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 5,
        body: enhanced.wealthStyle.summary,
        source: 'llm',
        retries: enhanced.retries as 0 | 1 | 2,
        cacheKey,
        generatedAt: new Date().toISOString(),
        validationFailures: [],
      };
      const envelope: PersistedChapterEnvelope = {
        schemaVersion: PERSISTED_CHAPTER_ENVELOPE_V1,
        generatedAt: entry.generatedAt,
        promptVersion, model,
        chapters: {
          ...(reading.chaptersEnvelope?.chapters ?? {}),
          5: entry,
        },
      };
      try {
        await updateReadingChapters(reading.id, envelope);
      } catch (writeError) {
        console.error('updateReadingChapters (ch5) failed', writeError);
      }
    }

    logChapterRun({
      chapterId: 5, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    });
    return {
      ...baseReport,
      wealthStyle: enhanced.wealthStyle,
    };
  } catch (error) {
    logChapterRun({
      chapterId: 5, source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0, cacheKey,
      validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}
