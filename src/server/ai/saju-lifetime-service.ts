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
// V2-5 PR L: 챕터 2 (기운의 균형) + 3 (역할과 보완) + 6 (직업 방향) + 7 (건강 리듬)
//   LLM enhancement 통합 + main 흐름 병렬화 (1·2·3·4·5·6·7 Promise.all).
import { enhanceLifetimeChapter2WithLLM } from './chapters/enhance-lifetime-chapter2';
import { buildChapter2Input } from './chapters/build-chapter2-input';
import { enhanceLifetimeChapter3WithLLM } from './chapters/enhance-lifetime-chapter3';
import { buildChapter3Input } from './chapters/build-chapter3-input';
import { enhanceLifetimeChapter6WithLLM } from './chapters/enhance-lifetime-chapter6';
import { buildChapter6Input } from './chapters/build-chapter6-input';
import { enhanceLifetimeChapter7WithLLM } from './chapters/enhance-lifetime-chapter7';
import { buildChapter7Input } from './chapters/build-chapter7-input';
// V2-5 PR K: 챕터 9 (평생 활용 전략) LLM synthesis 통합.
//   진단서 §3-1 ⑨ "9장이 1~7장 문장 복붙" 문제 해결. priorChapterDigests
//   1~7장 입력 + cross-chapter validator 룰로 복사 차단.
import { enhanceLifetimeChapter9WithLLM } from './chapters/enhance-lifetime-chapter9';
import { buildChapter9Input, extractChapterDigest } from './chapters/build-chapter9-input';
import { CHAPTER_META } from './chapters/chapter-prompts';
import type {
  ChapterId,
  ChapterPriorDigest,
} from './chapters/chapter-input-types';
import { OpenAIChapterClient } from './chapters/openai-chapter-client';
import {
  buildChapterCacheKey,
  isChapterCacheFresh,
  isChapterLLMEnabled,
} from './chapters/chapter-cache';
import { logChapterRun, logChapterRunWithUsage } from './chapters/chapter-telemetry';
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
  // 🟡 대운 다양성 fix (이전 PR L 은 병렬): 챕터 1→2→3→4→5→6→7 *직렬* LLM enhance.
  //   - 직렬 이유: 각 챕터가 *앞서 생성된 챕터*(priorChapterDigests + 본문) 를 보고
  //     같은 문장/첫 문장 반복을 피하도록. (병렬이면 형제 챕터가 서로를 못 봐서
  //     cross-chapter dedup 룰이 1~7 에서 무력화 — 챕터끼리 복붙 위험.) 챕터 9 가
  //     이미 쓰던 패턴(priorChapterDigests)을 1~7 에도 동일 적용.
  //   - 각 챕터에 (a) priorChapterDigests = 앞 챕터 enhanced summary 의 50자 digest,
  //     (b) crossChapterContext.allChapters = 앞 챕터 enhanced 본문 → validator 의
  //     cross-chapter/punch-copy 룰이 첫 문장 정확 일치를 reject.
  //   - cache hit 은 즉시 반환, miss 만 OpenAI 호출 + envelope upsert.
  //   - 비활성 / 실패 시 해당 챕터는 baseReport 그대로 (회귀 0).
  //
  //   응답 시간 trade-off: 병렬 7 챕터 ≈ 5초(가장 느린 챕터) → 직렬 7 챕터는 각
  //   챕터 지연의 합(cache miss 시 ≈ 합산). cache hit 시에는 거의 즉시. 다양성
  //   확보를 위한 의도된 비용.
  //
  //   주의 (PR J 에서 이어옴): 동일 request 안에서 여러 챕터 cache miss 시
  //   envelope upsert 는 last-write-wins (각 apply 가 pre-upsert snapshot 만 봄).
  //   결과: DB envelope 에 마지막 챕터 entry 만 남음. 다음 request 에서 나머지
  //   챕터 cache miss → LLM 재호출 → envelope 모두 갖춤 (eventually consistent).
  let report = baseReport;
  // 앞 챕터 누적: digest(50자) + 본문(cross-chapter validator 입력).
  const priorChapterDigests: ChapterPriorDigest[] = [];
  // allChapters 는 1-indexed 챕터 슬롯 9칸 (validator 가 chapterId-1 로 인덱싱).
  //   아직 안 만든 챕터는 빈 문자열 → 매치 X.
  const accumulatedBodies: string[] = ['', '', '', '', '', '', '', '', ''];

  const sequentialChapters: ReadonlyArray<{
    id: Exclude<ChapterId, 8 | 9>;
    apply: (
      reading: ReadingRecord,
      baseReport: ReturnType<typeof buildLifetimeReport>,
      userSituation: Parameters<typeof buildLifetimeReport>[3],
      model: string,
      promptVersion: string,
      priorChapterDigests: ChapterPriorDigest[],
      crossChapterContext: { allChapters: string[]; punchLines?: string[] }
    ) => Promise<ReturnType<typeof buildLifetimeReport>>;
    summaryOf: (report: ReturnType<typeof buildLifetimeReport>) => string;
  }> = [
    { id: 1, apply: applyChapter1LLMEnhancement, summaryOf: (r) => r.coreIdentity.summary },
    { id: 2, apply: applyChapter2LLMEnhancement, summaryOf: (r) => r.strengthBalance.summary },
    { id: 3, apply: applyChapter3LLMEnhancement, summaryOf: (r) => r.patternAndYongsin.summary },
    { id: 4, apply: applyChapter4LLMEnhancement, summaryOf: (r) => r.relationshipPattern.summary },
    { id: 5, apply: applyChapter5LLMEnhancement, summaryOf: (r) => r.wealthStyle.summary },
    { id: 6, apply: applyChapter6LLMEnhancement, summaryOf: (r) => r.careerDirection.summary },
    { id: 7, apply: applyChapter7LLMEnhancement, summaryOf: (r) => r.healthRhythm.summary },
  ];

  for (const { id, apply, summaryOf } of sequentialChapters) {
    // 앞 챕터들의 digest/본문 snapshot 을 넘긴다 (이번 챕터는 아직 미반영).
    report = await apply(
      reading,
      report,
      userSituation,
      model,
      promptVersion,
      [...priorChapterDigests],
      { allChapters: [...accumulatedBodies], punchLines: [] }
    );
    // 이번 챕터의 enhanced(또는 fallback) summary 를 누적 — 다음 챕터가 본다.
    const summary = summaryOf(report);
    accumulatedBodies[id - 1] = summary;
    priorChapterDigests.push({
      chapterId: id,
      title: CHAPTER_META[id].title,
      digest: extractChapterDigest(summary),
    });
  }
  // 🟡 챕터 9 synthesis — 1~7 LLM 적용 *이후* 직렬 호출.
  //   priorChapterDigests 가 enhanced summary 를 digest 소스로 사용해야 LLM 이
  //   *최신 본문* 을 재해석함. 1~7 가 fallback 이면 deterministic summary 그대로
  //   digest 가 되므로 안전.
  report = await applyChapter9LLMEnhancement(
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
  promptVersion: string,
  priorChapterDigests: ChapterPriorDigest[] = [],
  crossChapterContext: { allChapters: string[]; punchLines?: string[] } = { allChapters: [] }
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(1)) return baseReport;

  const chapter1Input = buildChapter1Input(
    reading.sajuData,
    userSituation ?? null,
    { name: reading.input.name ?? null, age: null },
    priorChapterDigests
  );
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
      client,
      { crossChapterContext }
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

    logChapterRunWithUsage({
      chapterId: 1,
      source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries,
      cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
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
  promptVersion: string,
  priorChapterDigests: ChapterPriorDigest[] = [],
  crossChapterContext: { allChapters: string[]; punchLines?: string[] } = { allChapters: [] }
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(4)) return baseReport;

  const chapter4Input = buildChapter4Input(
    reading.sajuData,
    userSituation ?? null,
    { name: reading.input.name ?? null, age: null },
    priorChapterDigests
  );
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
      baseReport.relationshipPattern, chapter4Input, client, { crossChapterContext }
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

    logChapterRunWithUsage({
      chapterId: 4, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
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
  promptVersion: string,
  priorChapterDigests: ChapterPriorDigest[] = [],
  crossChapterContext: { allChapters: string[]; punchLines?: string[] } = { allChapters: [] }
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(5)) return baseReport;

  const chapter5Input = buildChapter5Input(
    reading.sajuData,
    userSituation ?? null,
    { name: reading.input.name ?? null, age: null },
    priorChapterDigests
  );
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
      baseReport.wealthStyle, chapter5Input, client, { crossChapterContext }
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

    logChapterRunWithUsage({
      chapterId: 5, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
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

/**
 * V2-5 PR L: 챕터 2 (기운의 균형) LLM enhancement.
 * applyChapter1/4/5 와 동일 패턴. 교체 대상: strengthBalance.summary.
 */
async function applyChapter2LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string,
  priorChapterDigests: ChapterPriorDigest[] = [],
  crossChapterContext: { allChapters: string[]; punchLines?: string[] } = { allChapters: [] }
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(2)) return baseReport;

  const chapter2Input = buildChapter2Input(
    reading.sajuData,
    userSituation ?? null,
    { name: reading.input.name ?? null, age: null },
    priorChapterDigests
  );
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter2Input.userContext, 2);
  const cached = reading.chaptersEnvelope?.chapters?.[2];
  const stageStartedAt = Date.now();

  if (cached && cached.cacheKey === cacheKey && cached.source === 'llm' && isChapterCacheFresh(cached.generatedAt)) {
    logChapterRun({
      chapterId: 2, source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries, cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      strengthBalance: { ...baseReport.strengthBalance, summary: cached.body },
    };
  }

  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter2WithLLM(
      baseReport.strengthBalance, chapter2Input, client, { crossChapterContext }
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 2, body: enhanced.strengthBalance.summary,
        source: 'llm', retries: enhanced.retries as 0 | 1 | 2,
        cacheKey, generatedAt: new Date().toISOString(),
        validationFailures: [],
      };
      const envelope: PersistedChapterEnvelope = {
        schemaVersion: PERSISTED_CHAPTER_ENVELOPE_V1,
        generatedAt: entry.generatedAt, promptVersion, model,
        chapters: { ...(reading.chaptersEnvelope?.chapters ?? {}), 2: entry },
      };
      try { await updateReadingChapters(reading.id, envelope); }
      catch (writeError) { console.error('updateReadingChapters (ch2) failed', writeError); }
    }

    logChapterRunWithUsage({
      chapterId: 2, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
    return { ...baseReport, strengthBalance: enhanced.strengthBalance };
  } catch (error) {
    logChapterRun({
      chapterId: 2, source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0, cacheKey, validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}

/**
 * V2-5 PR L: 챕터 3 (역할과 보완 힌트) LLM enhancement.
 * 교체 대상: patternAndYongsin.summary.
 */
async function applyChapter3LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string,
  priorChapterDigests: ChapterPriorDigest[] = [],
  crossChapterContext: { allChapters: string[]; punchLines?: string[] } = { allChapters: [] }
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(3)) return baseReport;

  const chapter3Input = buildChapter3Input(
    reading.sajuData,
    userSituation ?? null,
    { name: reading.input.name ?? null, age: null },
    priorChapterDigests
  );
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter3Input.userContext, 3);
  const cached = reading.chaptersEnvelope?.chapters?.[3];
  const stageStartedAt = Date.now();

  if (cached && cached.cacheKey === cacheKey && cached.source === 'llm' && isChapterCacheFresh(cached.generatedAt)) {
    logChapterRun({
      chapterId: 3, source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries, cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      patternAndYongsin: { ...baseReport.patternAndYongsin, summary: cached.body },
    };
  }

  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter3WithLLM(
      baseReport.patternAndYongsin, chapter3Input, client, { crossChapterContext }
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 3, body: enhanced.patternAndYongsin.summary,
        source: 'llm', retries: enhanced.retries as 0 | 1 | 2,
        cacheKey, generatedAt: new Date().toISOString(),
        validationFailures: [],
      };
      const envelope: PersistedChapterEnvelope = {
        schemaVersion: PERSISTED_CHAPTER_ENVELOPE_V1,
        generatedAt: entry.generatedAt, promptVersion, model,
        chapters: { ...(reading.chaptersEnvelope?.chapters ?? {}), 3: entry },
      };
      try { await updateReadingChapters(reading.id, envelope); }
      catch (writeError) { console.error('updateReadingChapters (ch3) failed', writeError); }
    }

    logChapterRunWithUsage({
      chapterId: 3, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
    return { ...baseReport, patternAndYongsin: enhanced.patternAndYongsin };
  } catch (error) {
    logChapterRun({
      chapterId: 3, source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0, cacheKey, validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}

/**
 * V2-5 PR L: 챕터 6 (직업 방향) LLM enhancement.
 * 교체 대상: careerDirection.summary.
 */
async function applyChapter6LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string,
  priorChapterDigests: ChapterPriorDigest[] = [],
  crossChapterContext: { allChapters: string[]; punchLines?: string[] } = { allChapters: [] }
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(6)) return baseReport;

  const chapter6Input = buildChapter6Input(
    reading.sajuData,
    userSituation ?? null,
    { name: reading.input.name ?? null, age: null },
    priorChapterDigests
  );
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter6Input.userContext, 6);
  const cached = reading.chaptersEnvelope?.chapters?.[6];
  const stageStartedAt = Date.now();

  if (cached && cached.cacheKey === cacheKey && cached.source === 'llm' && isChapterCacheFresh(cached.generatedAt)) {
    logChapterRun({
      chapterId: 6, source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries, cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      careerDirection: { ...baseReport.careerDirection, summary: cached.body },
    };
  }

  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter6WithLLM(
      baseReport.careerDirection, chapter6Input, client, { crossChapterContext }
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 6, body: enhanced.careerDirection.summary,
        source: 'llm', retries: enhanced.retries as 0 | 1 | 2,
        cacheKey, generatedAt: new Date().toISOString(),
        validationFailures: [],
      };
      const envelope: PersistedChapterEnvelope = {
        schemaVersion: PERSISTED_CHAPTER_ENVELOPE_V1,
        generatedAt: entry.generatedAt, promptVersion, model,
        chapters: { ...(reading.chaptersEnvelope?.chapters ?? {}), 6: entry },
      };
      try { await updateReadingChapters(reading.id, envelope); }
      catch (writeError) { console.error('updateReadingChapters (ch6) failed', writeError); }
    }

    logChapterRunWithUsage({
      chapterId: 6, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
    return { ...baseReport, careerDirection: enhanced.careerDirection };
  } catch (error) {
    logChapterRun({
      chapterId: 6, source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0, cacheKey, validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}

/**
 * V2-5 PR L: 챕터 7 (건강 리듬) LLM enhancement.
 * 교체 대상: healthRhythm.summary.
 * 의료법 가드는 CHAPTER_META[7].forbiddenTopics + validator FORBIDDEN_ABSOLUTE_PHRASES.
 */
async function applyChapter7LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string,
  priorChapterDigests: ChapterPriorDigest[] = [],
  crossChapterContext: { allChapters: string[]; punchLines?: string[] } = { allChapters: [] }
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(7)) return baseReport;

  const chapter7Input = buildChapter7Input(
    reading.sajuData,
    userSituation ?? null,
    { name: reading.input.name ?? null, age: null },
    priorChapterDigests
  );
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter7Input.userContext, 7);
  const cached = reading.chaptersEnvelope?.chapters?.[7];
  const stageStartedAt = Date.now();

  if (cached && cached.cacheKey === cacheKey && cached.source === 'llm' && isChapterCacheFresh(cached.generatedAt)) {
    logChapterRun({
      chapterId: 7, source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries, cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      healthRhythm: { ...baseReport.healthRhythm, summary: cached.body },
    };
  }

  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter7WithLLM(
      baseReport.healthRhythm, chapter7Input, client, { crossChapterContext }
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 7, body: enhanced.healthRhythm.summary,
        source: 'llm', retries: enhanced.retries as 0 | 1 | 2,
        cacheKey, generatedAt: new Date().toISOString(),
        validationFailures: [],
      };
      const envelope: PersistedChapterEnvelope = {
        schemaVersion: PERSISTED_CHAPTER_ENVELOPE_V1,
        generatedAt: entry.generatedAt, promptVersion, model,
        chapters: { ...(reading.chaptersEnvelope?.chapters ?? {}), 7: entry },
      };
      try { await updateReadingChapters(reading.id, envelope); }
      catch (writeError) { console.error('updateReadingChapters (ch7) failed', writeError); }
    }

    logChapterRunWithUsage({
      chapterId: 7, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
    return { ...baseReport, healthRhythm: enhanced.healthRhythm };
  } catch (error) {
    logChapterRun({
      chapterId: 7, source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0, cacheKey, validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}

/**
 * V2-5 PR K: 챕터 9 (평생 활용 전략) LLM synthesis.
 * 진단서 §3-1 ⑨ "9장이 1~7장 본문 복붙" 문제 해결.
 *
 * 흐름은 applyChapter{1,4,5}LLMEnhancement 와 동일 (env flag + cache + envelope).
 * 차이점:
 *   - input 빌더가 buildChapter9Input — 1~7장 baseReport 섹션을 priorChapterDigests
 *     로 함께 전달.
 *   - reading.sajuData 외에 baseReport (1~7장 enhanced 결과) 도 입력으로 사용.
 *   - 교체 대상 필드는 lifetimeStrategy.summary.
 */
async function applyChapter9LLMEnhancement(
  reading: ReadingRecord,
  baseReport: ReturnType<typeof buildLifetimeReport>,
  userSituation: Parameters<typeof buildLifetimeReport>[3],
  model: string,
  promptVersion: string
): Promise<ReturnType<typeof buildLifetimeReport>> {
  if (!isChapterLLMEnabled(9)) return baseReport;

  const chapter9Input = buildChapter9Input(
    reading.sajuData,
    userSituation ?? null,
    {
      coreIdentity: baseReport.coreIdentity,
      strengthBalance: baseReport.strengthBalance,
      patternAndYongsin: baseReport.patternAndYongsin,
      relationshipPattern: baseReport.relationshipPattern,
      wealthStyle: baseReport.wealthStyle,
      careerDirection: baseReport.careerDirection,
      healthRhythm: baseReport.healthRhythm,
    },
    {
      name: reading.input.name ?? null,
      age: null,
    }
  );
  const cacheKey = buildChapterCacheKey(reading.sajuData, chapter9Input.userContext, 9);
  const cached = reading.chaptersEnvelope?.chapters?.[9];
  const stageStartedAt = Date.now();

  if (
    cached &&
    cached.cacheKey === cacheKey &&
    cached.source === 'llm' &&
    isChapterCacheFresh(cached.generatedAt)
  ) {
    logChapterRun({
      chapterId: 9, source: 'cache',
      durationMs: Date.now() - stageStartedAt,
      retries: cached.retries, cacheKey,
      validationFailures: cached.validationFailures ?? [],
    });
    return {
      ...baseReport,
      lifetimeStrategy: { ...baseReport.lifetimeStrategy, summary: cached.body },
    };
  }

  try {
    const client = new OpenAIChapterClient({ model });
    const enhanced = await enhanceLifetimeChapter9WithLLM(
      baseReport.lifetimeStrategy, chapter9Input, client
    );

    if (enhanced.source === 'llm' && isReadingId(reading.id)) {
      const entry: PersistedChapterEntry = {
        chapterId: 9,
        body: enhanced.lifetimeStrategy.summary,
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
          9: entry,
        },
      };
      try {
        await updateReadingChapters(reading.id, envelope);
      } catch (writeError) {
        console.error('updateReadingChapters (ch9) failed', writeError);
      }
    }

    logChapterRunWithUsage({
      chapterId: 9, source: enhanced.source,
      durationMs: Date.now() - stageStartedAt,
      retries: enhanced.retries, cacheKey,
      validationFailures: [],
    }, { client, userId: reading.userId });
    return {
      ...baseReport,
      lifetimeStrategy: enhanced.lifetimeStrategy,
    };
  } catch (error) {
    logChapterRun({
      chapterId: 9, source: 'fallback',
      durationMs: Date.now() - stageStartedAt,
      retries: 0, cacheKey,
      validationFailures: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return baseReport;
  }
}
