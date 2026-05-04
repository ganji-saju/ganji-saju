import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { fromSlug } from './pillars';
import type { BirthInput, SajuResult as LegacySajuResult } from './types';
import {
  calculateSajuDataV1,
  deriveLegacySajuResult,
  normalizeToSajuDataV1,
  type SajuDataV1,
} from '@/domain/saju/engine/saju-data-v1';
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

const READING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ReadingRow {
  id: string;
  user_id: string | null;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: number | null;
  gender: 'male' | 'female' | null;
  result_json: unknown;
}

type SupabaseReadingsClient = Awaited<ReturnType<typeof createServiceClient>>;

export interface PersistedReadingEnvelope {
  _grounding?: SajuInterpretationGrounding;
  _kasiComparison?: KasiSingleInputComparison | null;
  _metadata?: SajuPersistedReadingMetadata;
}

export interface ReadingRecord {
  id: string;
  userId: string | null;
  input: BirthInput;
  sajuData: SajuDataV1;
  result: LegacySajuResult;
  grounding: SajuInterpretationGrounding;
  kasiComparison: KasiSingleInputComparison | null;
  metadata: SajuPersistedReadingMetadata;
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
  sajuData: SajuDataV1
): BirthInput {
  return {
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

function mapReadingRow(row: ReadingRow): ReadingRecord {
  const input: BirthInput = {
    year: row.birth_year,
    month: row.birth_month,
    day: row.birth_day,
    hour: row.birth_hour ?? undefined,
    gender: row.gender ?? undefined,
  };
  const persisted = extractPersistedReadingEnvelope(row.result_json);
  const sajuData = normalizeToSajuDataV1(input, row.result_json);
  const normalizedInput = deriveBirthInputFromSajuData(input, sajuData);
  const report = buildSajuReport(normalizedInput, sajuData, 'today');
  const grounding =
    persisted._grounding ??
    buildSajuInterpretationGrounding(normalizedInput, sajuData, report);
  const metadata =
    persisted._metadata ??
    buildPersistedSajuReadingMetadata(normalizedInput, sajuData, grounding, persisted._kasiComparison ?? null);

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
  };
}

export async function buildReadingInsertPayload(input: BirthInput, userId: string | null) {
  const sajuData = calculateSajuDataV1(input);
  const normalizedInput = deriveBirthInputFromSajuData(input, sajuData);
  const report = buildSajuReport(normalizedInput, sajuData, 'today');
  const grounding = buildSajuInterpretationGrounding(normalizedInput, sajuData, report);
  const kasiComparison = await buildKasiComparisonSnapshot(normalizedInput);
  const metadata = buildPersistedSajuReadingMetadata(normalizedInput, sajuData, grounding, kasiComparison);
  const persistedResultJson = createStoredReadingResultJson(sajuData, grounding, kasiComparison, metadata);

  return {
    user_id: userId,
    birth_year: input.year,
    birth_month: input.month,
    birth_day: input.day,
    birth_hour: input.hour ?? null,
    gender: input.gender ?? null,
    result_json: persistedResultJson,
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
  userId: string | null
): Promise<string> {
  const supabase = await getPrivilegedOrSessionClient(userId);
  const payload = await buildReadingInsertPayload(input, userId);

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

export async function getReadingById(id: string): Promise<ReadingRecord | null> {
  if (!isReadingId(id)) return null;

  const supabase = await getPrivilegedOrSessionClient('authenticated-read');
  const { data, error } = await supabase
    .from('readings')
    .select(
      'id, user_id, birth_year, birth_month, birth_day, birth_hour, gender, result_json'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  return mapReadingRow(data as ReadingRow);
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

  const sajuData = calculateSajuDataV1(input);
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
  };
}
