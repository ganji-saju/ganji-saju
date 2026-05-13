import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import {
  normalizeEntitlementScopeKey,
  type PaidProductId,
  type PaymentProductScope,
} from '@/lib/payments/product-scope';
import {
  PERSONALITY_COMPATIBILITY_MINI_NAME,
  isPersonalityCompatibilityMiniProductId,
} from '@/lib/payments/personality-compatibility';
import {
  SAJU_PERSONALITY_MINI_NAME,
  isSajuPersonalityMiniProductId,
} from '@/lib/payments/saju-personality';
import { isReadingId, type ReadingRecord } from '@/lib/saju/readings';
import type { ProductEntitlement } from '@/lib/product-entitlements';

export interface PaidReadingSnapshot {
  id: string;
  entitlementId: string | null;
  userId: string;
  productId: PaidProductId;
  scopeKey: string;
  readingId: string | null;
  readingKey: string | null;
  sourceSlug: string | null;
  title: string;
  summary: string | null;
  snapshotJson: Record<string, unknown>;
  occurredOn: string | null;
  targetYear: number | null;
  targetMonth: number | null;
  createdAt: string;
}

interface PaidReadingSnapshotRow {
  id: string;
  entitlement_id: string | null;
  user_id: string;
  product_id: PaidProductId;
  scope_key: string;
  reading_id: string | null;
  reading_key: string | null;
  source_slug: string | null;
  title: string;
  summary: string | null;
  snapshot_json: Record<string, unknown> | null;
  occurred_on: string | null;
  target_year: number | null;
  target_month: number | null;
  created_at: string;
}

export function toKoreaDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function mapRow(row: PaidReadingSnapshotRow): PaidReadingSnapshot {
  return {
    id: row.id,
    entitlementId: row.entitlement_id,
    userId: row.user_id,
    productId: row.product_id,
    scopeKey: row.scope_key,
    readingId: row.reading_id,
    readingKey: row.reading_key,
    sourceSlug: row.source_slug,
    title: row.title,
    summary: row.summary,
    snapshotJson: row.snapshot_json ?? {},
    occurredOn: row.occurred_on,
    targetYear: row.target_year,
    targetMonth: row.target_month,
    createdAt: row.created_at,
  };
}

export function getPaidProductTitle(productId: PaidProductId) {
  switch (productId) {
    case 'today-detail':
      return '오늘 자세히 보기';
    case 'monthly-calendar':
      return '월간 달력';
    case 'year-core':
      return '올해 핵심 보기';
    case 'lifetime-report':
      return '평생 소장 사주풀이';
    case 'love-question':
      return '연애 마음 확인';
    case 'money-pattern':
      return '돈이 새는 패턴';
    case 'work-flow':
      return '일/직장 흐름';
    default:
      if (isPersonalityCompatibilityMiniProductId(productId)) {
        return PERSONALITY_COMPATIBILITY_MINI_NAME;
      }
      if (isSajuPersonalityMiniProductId(productId)) {
        return SAJU_PERSONALITY_MINI_NAME;
      }
      return '구매한 풀이';
  }
}

export function buildSnapshotSummary(productId: PaidProductId, reading: ReadingRecord | null) {
  const date = toKoreaDate(reading?.sajuData.metadata.calculatedAt);

  if (productId === 'today-detail' && date) {
    return `${date}에 열어본 오늘운 상세 풀이`;
  }

  if (productId === 'lifetime-report') {
    return '결제 시점의 사주 계산값과 풀이 연결 정보를 보관합니다.';
  }

  if (isPersonalityCompatibilityMiniProductId(productId)) {
    return '결제한 성향궁합 결과의 깊이보기 권한입니다.';
  }

  if (isSajuPersonalityMiniProductId(productId)) {
    return '결제한 성향사주 결과의 깊이보기 권한입니다.';
  }

  return reading
    ? `${reading.input.year}.${reading.input.month}.${reading.input.day} 기준 풀이`
    : '결제 시점의 풀이 정보를 보관합니다.';
}

export function buildSnapshotJson(productId: PaidProductId, scope: PaymentProductScope | null) {
  const reading = scope?.reading ?? null;

  return {
    productId,
    scopeKey: scope?.scopeKey ?? null,
    readingInput: reading?.input ?? null,
    sajuData: reading?.sajuData ?? null,
    readingMetadata: reading?.metadata ?? null,
    targetYear: scope?.targetYear ?? null,
    targetMonth: scope?.targetMonth ?? null,
    capturedAt: new Date().toISOString(),
  };
}

export async function getPaidReadingSnapshot(
  userId: string | null | undefined,
  productId: PaidProductId,
  scopeKey: string | null | undefined
) {
  if (!userId || !hasSupabaseServiceEnv) return null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('paid_reading_snapshots')
    .select(
      'id, entitlement_id, user_id, product_id, scope_key, reading_id, reading_key, source_slug, title, summary, snapshot_json, occurred_on, target_year, target_month, created_at'
    )
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('scope_key', normalizeEntitlementScopeKey(scopeKey))
    .maybeSingle();

  if (error) return null;
  return data ? mapRow(data as PaidReadingSnapshotRow) : null;
}

export async function listPaidReadingSnapshotsForUser(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  if (!hasSupabaseServiceEnv) return [];

  const service = await createServiceClient();
  const { data, error } = await service
    .from('paid_reading_snapshots')
    .select(
      'id, entitlement_id, user_id, product_id, scope_key, reading_id, reading_key, source_slug, title, summary, snapshot_json, occurred_on, target_year, target_month, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 30) - 1);

  if (error) return [];
  return ((data as PaidReadingSnapshotRow[] | null) ?? []).map(mapRow);
}

export async function upsertPaidReadingSnapshot(input: {
  userId: string;
  productId: PaidProductId;
  entitlement: ProductEntitlement | null;
  scope: PaymentProductScope | null;
  sourceSlug?: string | null;
}) {
  if (!hasSupabaseServiceEnv) return null;

  const service = await createServiceClient();
  const reading = input.scope?.reading ?? null;
  const scopeKey = normalizeEntitlementScopeKey(input.scope?.scopeKey);
  const readingId = reading && isReadingId(reading.id) ? reading.id : null;
  const payload = {
    entitlement_id: input.entitlement?.id ?? null,
    user_id: input.userId,
    product_id: input.productId,
    scope_key: scopeKey,
    reading_id: readingId,
    reading_key: input.scope?.readingKey ?? null,
    source_slug: input.sourceSlug ?? input.scope?.slug ?? null,
    title: getPaidProductTitle(input.productId),
    summary: buildSnapshotSummary(input.productId, reading),
    snapshot_json: buildSnapshotJson(input.productId, input.scope),
    occurred_on: toKoreaDate(reading?.sajuData.metadata.calculatedAt),
    target_year: input.scope?.targetYear ?? null,
    target_month: input.scope?.targetMonth ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await service
    .from('paid_reading_snapshots')
    .upsert(payload, {
      onConflict: 'user_id,product_id,scope_key',
    })
    .select(
      'id, entitlement_id, user_id, product_id, scope_key, reading_id, reading_key, source_slug, title, summary, snapshot_json, occurred_on, target_year, target_month, created_at'
    )
    .single();

  if (error || !data) {
    console.warn('paid reading snapshot write failed', error);
    return null;
  }

  return mapRow(data as PaidReadingSnapshotRow);
}
