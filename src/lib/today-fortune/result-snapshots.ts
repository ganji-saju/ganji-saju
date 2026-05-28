import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { toSlug } from '@/lib/saju/pillars';
import { isReadingId, type ReadingRecord } from '@/lib/saju/readings';
import type {
  ConcernId,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
} from '@/lib/today-fortune/types';
import type { MoonlightCounselorId } from '@/lib/counselors';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';

export const TODAY_FORTUNE_RESULT_SNAPSHOT_VERSION = 'today-fortune-result-snapshot/v1';
export const TODAY_FORTUNE_RESULT_BUILDER_VERSION = 'today-fortune-builder/v1';

export interface TodayFortuneResultSnapshot {
  id: string;
  userId: string;
  readingId: string | null;
  readingKey: string;
  sourceSessionId: string | null;
  sourceSlug: string | null;
  scopeKey: string;
  occurredOn: string;
  concernId: ConcernId;
  counselorId: MoonlightCounselorId | null;
  inputJson: Record<string, unknown>;
  freeResult: TodayFortuneFreeResult;
  premiumResult: TodayFortunePremiumResult;
  snapshotJson: Record<string, unknown>;
  snapshotVersion: string;
  builderVersion: string;
  accessSource: string | null;
  entitlementId: string | null;
  paymentOrderId: string | null;
  paymentKey: string | null;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface TodayFortuneResultSnapshotRow {
  id: string;
  user_id: string;
  reading_id: string | null;
  reading_key: string;
  source_session_id: string | null;
  source_slug: string | null;
  scope_key: string;
  occurred_on: string;
  concern_id: ConcernId;
  counselor_id: MoonlightCounselorId | null;
  input_json: Record<string, unknown> | null;
  free_result_json: TodayFortuneFreeResult;
  premium_result_json: TodayFortunePremiumResult;
  snapshot_json: Record<string, unknown> | null;
  snapshot_version: string;
  builder_version: string;
  access_source: string | null;
  entitlement_id: string | null;
  payment_order_id: string | null;
  payment_key: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface BuildTodayFortuneSnapshotContentInput {
  reading: ReadingRecord;
  sourceSessionId: string;
  concernId: ConcernId;
  counselorId: MoonlightCounselorId | null;
  now?: Date;
}

export interface StoreTodayFortuneResultSnapshotInput
  extends BuildTodayFortuneSnapshotContentInput {
  userId: string;
  accessSource?: string | null;
  entitlementId?: string | null;
  paymentOrderId?: string | null;
  paymentKey?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function buildTodayFortuneResultSnapshotScopeKey(input: {
  readingKey: string;
  occurredOn: string;
  concernId: ConcernId;
}) {
  return `today-detail:${input.readingKey}:${input.occurredOn}:${input.concernId}`;
}

export function buildTodayFortuneResultSnapshotHref(id: string) {
  return `/today-fortune/snapshots/${encodeURIComponent(id)}`;
}

export function buildTodayFortuneResultSnapshotSummary(occurredOn: string) {
  return `${occurredOn}에 보관된 오늘운세 상세 풀이`;
}

function mapRow(row: TodayFortuneResultSnapshotRow): TodayFortuneResultSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    readingId: row.reading_id,
    readingKey: row.reading_key,
    sourceSessionId: row.source_session_id,
    sourceSlug: row.source_slug,
    scopeKey: row.scope_key,
    occurredOn: row.occurred_on,
    concernId: row.concern_id,
    counselorId: row.counselor_id,
    inputJson: row.input_json ?? {},
    freeResult: row.free_result_json,
    premiumResult: row.premium_result_json,
    snapshotJson: row.snapshot_json ?? {},
    snapshotVersion: row.snapshot_version,
    builderVersion: row.builder_version,
    accessSource: row.access_source,
    entitlementId: row.entitlement_id,
    paymentOrderId: row.payment_order_id,
    paymentKey: row.payment_key,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SNAPSHOT_SELECT = [
  'id',
  'user_id',
  'reading_id',
  'reading_key',
  'source_session_id',
  'source_slug',
  'scope_key',
  'occurred_on',
  'concern_id',
  'counselor_id',
  'input_json',
  'free_result_json',
  'premium_result_json',
  'snapshot_json',
  'snapshot_version',
  'builder_version',
  'access_source',
  'entitlement_id',
  'payment_order_id',
  'payment_key',
  'generated_at',
  'created_at',
  'updated_at',
].join(', ');

export function buildTodayFortuneSnapshotContent({
  reading,
  sourceSessionId,
  concernId,
  counselorId,
  now = new Date(),
}: BuildTodayFortuneSnapshotContentInput) {
  const todaySajuData = buildFreshTodaySajuData(reading.input, { now });
  const freeResult = buildTodayFortuneFreeResult(reading.input, todaySajuData, {
    concernId,
    sourceSessionId,
    calendarType: 'solar',
    timeRule: 'standard',
    counselorId,
    grounding: reading.grounding,
    kasiComparison: reading.kasiComparison,
    now,
  });
  const premiumResult = buildTodayFortunePremiumResult(
    reading.input,
    todaySajuData,
    concernId,
    reading.grounding,
    reading.kasiComparison,
    { now }
  );
  const readingKey = toSlug(reading.input);
  const occurredOn = freeResult.dateKey;
  const scopeKey = buildTodayFortuneResultSnapshotScopeKey({
    readingKey,
    occurredOn,
    concernId,
  });
  const generatedAt = now.toISOString();

  return {
    readingKey,
    occurredOn,
    scopeKey,
    generatedAt,
    freeResult,
    premiumResult,
    snapshotJson: {
      kind: TODAY_FORTUNE_RESULT_SNAPSHOT_VERSION,
      productId: 'today-detail',
      readingKey,
      sourceSessionId,
      concernId,
      counselorId,
      occurredOn,
      generatedAt,
      builderVersion: TODAY_FORTUNE_RESULT_BUILDER_VERSION,
    },
  };
}

export async function getTodayFortuneResultSnapshotById(
  userId: string | null | undefined,
  id: string | null | undefined
) {
  if (!userId || !id || !hasSupabaseServiceEnv) return null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as unknown as TodayFortuneResultSnapshotRow);
}

export async function getTodayFortuneResultSnapshotByScope(
  userId: string | null | undefined,
  scopeKey: string | null | undefined
) {
  if (!userId || !scopeKey || !hasSupabaseServiceEnv) return null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
    .eq('scope_key', scopeKey)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as unknown as TodayFortuneResultSnapshotRow);
}

export async function listTodayFortuneResultSnapshotsForUser(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  if (!hasSupabaseServiceEnv) return [];

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 30;
  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return [];
  return ((data as unknown as TodayFortuneResultSnapshotRow[] | null) ?? []).map(mapRow);
}

export async function upsertTodayFortuneResultSnapshot(
  input: StoreTodayFortuneResultSnapshotInput
) {
  if (!hasSupabaseServiceEnv) return null;

  const content = buildTodayFortuneSnapshotContent(input);
  const readingId = isReadingId(input.reading.id) ? input.reading.id : null;
  const service = await createServiceClient();
  const payload = {
    user_id: input.userId,
    reading_id: readingId,
    reading_key: content.readingKey,
    source_session_id: input.sourceSessionId,
    source_slug: input.sourceSessionId,
    scope_key: content.scopeKey,
    occurred_on: content.occurredOn,
    concern_id: input.concernId,
    counselor_id: input.counselorId,
    input_json: asRecord(input.reading.input),
    free_result_json: content.freeResult,
    premium_result_json: content.premiumResult,
    snapshot_json: content.snapshotJson,
    snapshot_version: TODAY_FORTUNE_RESULT_SNAPSHOT_VERSION,
    builder_version: TODAY_FORTUNE_RESULT_BUILDER_VERSION,
    access_source: input.accessSource ?? null,
    entitlement_id: input.entitlementId ?? null,
    payment_order_id: input.paymentOrderId ?? null,
    payment_key: input.paymentKey ?? null,
    generated_at: content.generatedAt,
  };

  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .upsert(payload, {
      onConflict: 'user_id,scope_key',
    })
    .select(SNAPSHOT_SELECT)
    .single();

  if (error || !data) {
    console.warn('today fortune result snapshot write failed', error);
    return null;
  }

  return mapRow(data as unknown as TodayFortuneResultSnapshotRow);
}
