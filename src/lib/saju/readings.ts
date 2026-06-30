import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { fromSlug, toSlug } from './pillars';
import type { BirthInput, SajuResult as LegacySajuResult } from './types';
import {
  calculateSajuDataV1,
  deriveLegacySajuResult,
  type SajuDataV1,
} from '@/domain/saju/engine/saju-data-v1';
import {
  loadSajuDataV2,
  type SajuDataV2,
} from '@/domain/saju/engine/saju-data-v2-upgrade';
import {
  buildSajuInterpretationGrounding,
  buildSajuReport,
  type SajuInterpretationGrounding,
} from '@/domain/saju/report';
import {
  compareBirthInputWithKasi,
  type KasiSingleInputComparison,
} from '@/domain/saju/validation/kasi-calendar';
import {
  buildPersistedSajuReadingMetadata,
  type SajuPersistedReadingMetadata,
} from '@/lib/saju/report-metadata';
import type { PersistedChapterEnvelope } from '@/server/ai/chapters/chapter-storage-types';

const READING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ReadingRow {
  id: string;
  user_id: string | null;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: number | null;
  gender: 'male' | 'female' | null;
  result_json: unknown;
  // 2026-05-15 PR 1 — 사용자 현재 상황. NULL 허용 (기존 row 호환).
  situation_json?: import('@/lib/saju/types').UserSituation | null;
}

type SupabaseReadingsClient = Awaited<ReturnType<typeof createServiceClient>>;

export interface PersistedReadingEnvelope {
  _grounding?: SajuInterpretationGrounding;
  _kasiComparison?: KasiSingleInputComparison | null;
  _metadata?: SajuPersistedReadingMetadata;
  /** V2-5 PR I: 챕터별 LLM 결과 캐시 (envelope V1 정책 — 별도 field 로 저장). */
  _chapters?: PersistedChapterEnvelope;
}

export interface ReadingRecord {
  id: string;
  userId: string | null;
  input: BirthInput;
  sajuData: SajuDataV1 | SajuDataV2;
  result: LegacySajuResult;
  grounding: SajuInterpretationGrounding;
  kasiComparison: KasiSingleInputComparison | null;
  metadata: SajuPersistedReadingMetadata;
  /** V2-5 PR I: envelope 의 _chapters 캐시 — null 이면 LLM 호출 시 신규 생성. */
  chaptersEnvelope: PersistedChapterEnvelope | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function extractPersistedReadingEnvelope(value: unknown): PersistedReadingEnvelope {
  const record = asRecord(value);
  if (!record) return {};

  return {
    _grounding: record._grounding as SajuInterpretationGrounding | undefined,
    _kasiComparison: (record._kasiComparison as KasiSingleInputComparison | null | undefined) ?? null,
    _metadata: record._metadata as SajuPersistedReadingMetadata | undefined,
    _chapters: record._chapters as PersistedChapterEnvelope | undefined,
  };
}

export function createStoredReadingResultJson(
  sajuData: SajuDataV1,
  grounding: SajuInterpretationGrounding,
  kasiComparison: KasiSingleInputComparison | null,
  metadata: SajuPersistedReadingMetadata
) {
  return {
    ...sajuData,
    _grounding: grounding,
    _kasiComparison: kasiComparison,
    _metadata: metadata,
  };
}

async function buildKasiComparisonSnapshot(input: BirthInput) {
  const serviceKey = process.env.KASI_SERVICE_KEY?.trim();
  if (!serviceKey) return null;

  try {
    return await compareBirthInputWithKasi(input, serviceKey);
  } catch {
    return null;
  }
}

function deriveBirthInputFromSajuData(
  fallback: BirthInput,
  sajuData: SajuDataV1 | SajuDataV2
): BirthInput {
  return {
    name: fallback.name,
    year: sajuData.input.birth.year,
    month: sajuData.input.birth.month,
    day: sajuData.input.birth.day,
    hour: sajuData.input.hourKnown ? sajuData.input.birth.hour ?? undefined : undefined,
    minute: sajuData.input.hourKnown ? sajuData.input.birth.minute ?? undefined : undefined,
    unknownTime: !sajuData.input.hourKnown,
    jasiMethod: sajuData.input.jasiMethod ?? sajuData.extensions?.orrery?.input.jasiMethod ?? fallback.jasiMethod,
    gender: sajuData.input.gender ?? fallback.gender ?? undefined,
    birthLocation:
      sajuData.input.location &&
      typeof sajuData.input.latitude === 'number' &&
      typeof sajuData.input.longitude === 'number'
        ? {
            code: sajuData.input.locationCode ?? undefined,
            label: sajuData.input.location,
            latitude: sajuData.input.latitude,
            longitude: sajuData.input.longitude,
            timezone: sajuData.input.timezone,
          }
        : fallback.birthLocation ?? undefined,
    solarTimeMode: sajuData.input.solarTimeMode ?? fallback.solarTimeMode,
  };
}

export function isReadingId(value: string): boolean {
  return READING_ID_PATTERN.test(value);
}

export function mapReadingRow(row: ReadingRow): ReadingRecord {
  const persisted = extractPersistedReadingEnvelope(row.result_json);
  const input: BirthInput = {
    name: persisted._metadata?.birthInputSnapshot.name ?? undefined,
    year: row.birth_year,
    month: row.birth_month,
    day: row.birth_day,
    hour: row.birth_hour ?? undefined,
    gender: row.gender ?? undefined,
  };
  // V2-3 (a) 정책: DB row 의 V1 envelope 를 in-memory V2 로 업그레이드. row 가 이미 V2
  // schemaVersion 이면 loadSajuDataV2 가 검증 후 그대로 사용. V1 또는 legacy 형태면
  // upgradeSajuDataV1ToV2 자동 호출. DB 저장 envelope 는 V1 그대로 유지 (저장 크기 보존).
  const sajuData = loadSajuDataV2(input, row.result_json);
  const normalizedInput = deriveBirthInputFromSajuData(input, sajuData);
  const report = buildSajuReport(normalizedInput, sajuData, 'today');
  // 2026-05-15 PR 1: situation_json 컬럼에서 userSituation 복원. NULL/누락 안전.
  const userSituation = row.situation_json ?? null;
  // 기존 persisted grounding 이 있어도 userSituation 이 새로 들어왔으면 재빌드 (promptFacts 갱신).
  const grounding =
    persisted._grounding?.personalizationContext && !userSituation
      ? persisted._grounding
      : buildSajuInterpretationGrounding(normalizedInput, sajuData, report, userSituation);
  const rebuiltMetadata = buildPersistedSajuReadingMetadata(
    normalizedInput,
    sajuData,
    grounding,
    persisted._kasiComparison ?? null,
    { userId: row.user_id }
  );
  const metadata = persisted._metadata
    ? {
        ...rebuiltMetadata,
        ...persisted._metadata,
        sajuDataHash: persisted._metadata.sajuDataHash ?? rebuiltMetadata.sajuDataHash,
        readingIdentityHash:
          persisted._metadata.readingIdentityHash ?? rebuiltMetadata.readingIdentityHash,
      }
    : rebuiltMetadata;

  return {
    id: row.id,
    userId: row.user_id,
    input: normalizedInput,
    sajuData,
    // Keep the legacy shape available while screens migrate to SajuDataV1.
    result: deriveLegacySajuResult(sajuData),
    grounding,
    kasiComparison: persisted._kasiComparison ?? null,
    metadata,
    chaptersEnvelope: persisted._chapters ?? null,
  };
}

export async function buildReadingInsertPayload(
  input: BirthInput,
  userId: string | null,
  // 2026-05-15 PR 1: 사용자 현재 상황 — 별도 컬럼 `situation_json` 으로 저장.
  // BirthInput 캐시 키와 분리해 reading slug 안정성 보장.
  userSituation: import('@/lib/saju/types').UserSituation | null = null
) {
  const sajuData = calculateSajuDataV1(input);
  const normalizedInput = deriveBirthInputFromSajuData(input, sajuData);
  const report = buildSajuReport(normalizedInput, sajuData, 'today');
  const grounding = buildSajuInterpretationGrounding(normalizedInput, sajuData, report, userSituation);
  const kasiComparison = await buildKasiComparisonSnapshot(normalizedInput);
  const metadata = buildPersistedSajuReadingMetadata(
    normalizedInput,
    sajuData,
    grounding,
    kasiComparison,
    { userId }
  );
  const persistedResultJson = createStoredReadingResultJson(sajuData, grounding, kasiComparison, metadata);

  return {
    user_id: userId,
    birth_year: input.year,
    birth_month: input.month,
    birth_day: input.day,
    birth_hour: input.hour ?? null,
    gender: input.gender ?? null,
    result_json: persistedResultJson,
    situation_json: userSituation ?? null,
  };
}

async function getPrivilegedOrSessionClient(userId?: string | null): Promise<SupabaseReadingsClient> {
  if (hasSupabaseServiceEnv) {
    return createServiceClient();
  }

  if (!userId) {
    throw new Error('로그인하지 않은 사주 결과 저장에는 Supabase 서비스 키가 필요합니다.');
  }

  return createClient() as Promise<SupabaseReadingsClient>;
}

export async function createReading(
  input: BirthInput,
  userId: string | null,
  // 2026-05-15 PR 1: 사용자 현재 상황. 옵션 — 없으면 NULL 저장 (기존 흐름 호환).
  userSituation: import('@/lib/saju/types').UserSituation | null = null
): Promise<string> {
  const supabase = await getPrivilegedOrSessionClient(userId);
  const payload = await buildReadingInsertPayload(input, userId, userSituation);

  const { data, error } = await supabase
    .from('readings')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '사주 결과를 저장하지 못했습니다.');
  }

  return data.id;
}

export async function ensureReadingOwnedByUser(
  reading: ReadingRecord,
  userId: string
): Promise<ReadingRecord> {
  if (reading.userId === userId) return reading;
  if (reading.userId && reading.userId !== userId) return reading;

  if (isReadingId(reading.id)) {
    const supabase = await getPrivilegedOrSessionClient(userId);
    const { error } = await supabase
      .from('readings')
      .update({ user_id: userId })
      .eq('id', reading.id)
      .is('user_id', null);

    if (error) {
      console.warn('anonymous reading ownership update failed', error);
      return reading;
    }

    return (await getReadingById(reading.id)) ?? {
      ...reading,
      userId,
    };
  }

  const ownedReadingId = await createReading(reading.input, userId);
  return (await getReadingById(ownedReadingId)) ?? {
    ...reading,
    id: ownedReadingId,
    userId,
  };
}

export async function getReadingById(id: string): Promise<ReadingRecord | null> {
  if (!isReadingId(id)) return null;

  const supabase = await getPrivilegedOrSessionClient('authenticated-read');
  const { data, error } = await supabase
    .from('readings')
    .select(
      // 2026-05-15 PR 1: situation_json 컬럼도 함께 가져와 grounding 재빌드에 사용.
      'id, user_id, birth_year, birth_month, birth_day, birth_hour, gender, result_json, situation_json'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  return mapReadingRow(data as ReadingRow);
}

// 2026-05-24 — today-fortune 생성이 매 요청마다 새 reading(UUID)을 INSERT 해
//   sourceSessionId 가 휘발성이 되던 문제. 로그인 사용자의 동일 identity 기존 reading 을
//   재사용해 안정화한다. (year,month,day) 후보를 좁힌 뒤 전체 readingKey(toSlug)로 확정
//   매치 — 위치/시간/성별/이름상태까지 동일해야 같은 reading 으로 인정(오매칭 방지).
export async function findReadingByInput(
  userId: string,
  input: BirthInput
): Promise<ReadingRecord | null> {
  if (!userId || !hasSupabaseServiceEnv) return null;

  const targetKey = toSlug(input);
  const supabase = await getPrivilegedOrSessionClient(userId);
  const { data, error } = await supabase
    .from('readings')
    .select(
      'id, user_id, birth_year, birth_month, birth_day, birth_hour, gender, result_json, situation_json'
    )
    .eq('user_id', userId)
    .eq('birth_year', input.year)
    .eq('birth_month', input.month)
    .eq('birth_day', input.day)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data || data.length === 0) return null;

  for (const row of data as ReadingRow[]) {
    const record = mapReadingRow(row);
    if (toSlug(record.input) === targetKey) return record;
  }
  return null;
}

export async function deleteReadingForUser(id: string, userId: string): Promise<boolean> {
  if (!isReadingId(id)) return false;

  const supabase = await getPrivilegedOrSessionClient(userId);
  const { data, error } = await supabase
    .from('readings')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getReadingCountForUser(userId: string): Promise<number> {
  const supabase = await getPrivilegedOrSessionClient(userId);
  const { count, error } = await supabase
    .from('readings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function resolveReading(
  identifier: string
): Promise<ReadingRecord | null> {
  if (isReadingId(identifier)) {
    return getReadingById(identifier);
  }

  const input = fromSlug(identifier);
  if (!input) return null;

  // V2-3 (a) 정책: guest slug resolve 도 in-memory V2 로 통일. 저장 없음.
  const sajuData = loadSajuDataV2(input, null);
  const normalizedInput = deriveBirthInputFromSajuData(input, sajuData);
  const report = buildSajuReport(normalizedInput, sajuData, 'today');
  const grounding = buildSajuInterpretationGrounding(normalizedInput, sajuData, report);

  return {
    id: identifier,
    userId: null,
    input: normalizedInput,
    sajuData,
    result: deriveLegacySajuResult(sajuData),
    grounding,
    kasiComparison: null,
    metadata: buildPersistedSajuReadingMetadata(normalizedInput, sajuData, grounding, null),
    // V2-5 PR I: guest slug 은 DB 저장 안 함 → chapters 캐시 없음.
    chaptersEnvelope: null,
  };
}

/**
 * V2-5 PR I: reading 의 result_json envelope `_chapters` field 를 upsert.
 * 기존 row 의 다른 envelope field (_grounding, _metadata 등) 와 sajuData 본체는 보존.
 *
 * 호출 시점: saju-lifetime-service 가 챕터 LLM 호출 성공 시 (cache miss). DB
 * round-trip 2회 (select 1 + update 1) — LLM 호출 횟수 대비 매우 적음.
 *
 * guest slug 또는 잘못된 readingId 면 silent skip (storage 없는 reading).
 */
export async function updateReadingChapters(
  readingId: string,
  chapterEnvelope: PersistedChapterEnvelope
): Promise<void> {
  if (!isReadingId(readingId)) return;

  const supabase = await getPrivilegedOrSessionClient('authenticated-write');

  const { data, error: fetchError } = await supabase
    .from('readings')
    .select('result_json')
    .eq('id', readingId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }
  if (!data?.result_json || typeof data.result_json !== 'object') {
    // reading 이 없거나 result_json 형태가 깨졌으면 silent skip — 다음 reading 조회 시 재시도.
    return;
  }

  const merged = {
    ...(data.result_json as Record<string, unknown>),
    _chapters: chapterEnvelope,
  };

  const { error: updateError } = await supabase
    .from('readings')
    .update({ result_json: merged })
    .eq('id', readingId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
