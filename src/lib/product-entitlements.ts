import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getPackage, isBundlePackage, type TasteProductId } from '@/lib/payments/catalog';
import {
  buildMonthlyCalendarScopeKey,
  buildReadingProductScopeKey,
  buildTodayDetailScopeKey,
  normalizeEntitlementScopeKey,
  parseLifetimeReportReadingKey,
  parseMonthlyCalendarScopeKey,
  parseYearCoreScopeKey,
  resolvePaymentProductScope,
  type PaidProductId,
} from '@/lib/payments/product-scope';
import {
  readingKeyMatchesCurrentSaju,
  sajuIdentityFromReadingKey,
} from '@/lib/saju/reading-identity';
import { revokeBundleComponents, type BundleRevokeResult } from '@/lib/payments/bundle';

export {
  buildMonthlyCalendarScopeKey,
  buildReadingProductScopeKey,
  buildTodayDetailScopeKey,
};

export interface ProductEntitlement {
  id: string;
  userId: string;
  productId: PaidProductId;
  scopeKey: string | null;
  orderId: string | null;
  paymentKey: string | null;
  amount: number | null;
  packageId: string | null;
  createdAt: string;
}

export type TasteProductEntitlement = ProductEntitlement & {
  productId: TasteProductId;
};

interface EntitlementTransactionRow {
  id: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
  amount: number | null;
  created_at: string;
}

interface ProductEntitlementRow {
  id: string;
  user_id: string;
  product_id: PaidProductId;
  scope_key: string;
  order_id: string | null;
  payment_key: string | null;
  package_id: string | null;
  amount: number | null;
  created_at: string;
}

function mapProductTableEntitlement(row: ProductEntitlementRow): ProductEntitlement {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    scopeKey: row.scope_key === 'global' ? null : row.scope_key,
    orderId: row.order_id,
    paymentKey: row.payment_key,
    amount: row.amount,
    packageId: row.package_id,
    createdAt: row.created_at,
  };
}

function mapLegacyEntitlement(row: EntitlementTransactionRow): TasteProductEntitlement {
  const metadata = row.metadata ?? {};

  return {
    id: row.id,
    userId: row.user_id,
    productId: metadata.productId as TasteProductId,
    scopeKey: typeof metadata.scopeKey === 'string' ? metadata.scopeKey : null,
    orderId: typeof metadata.orderId === 'string' ? metadata.orderId : null,
    paymentKey: typeof metadata.paymentKey === 'string' ? metadata.paymentKey : null,
    amount: typeof metadata.amount === 'number' ? metadata.amount : row.amount,
    packageId: typeof metadata.packageId === 'string' ? metadata.packageId : null,
    createdAt: row.created_at,
  };
}

function matchesProductScope(metadata: Record<string, unknown>, scopeKey: string | null) {
  if (!scopeKey) return metadata.scopeKey === undefined || metadata.scopeKey === null || metadata.scopeKey === '';
  return metadata.scopeKey === scopeKey || metadata.scopeKey === undefined || metadata.scopeKey === null;
}

async function getProductTableEntitlement(
  userId: string,
  productId: PaidProductId,
  scopeKey: string | null
) {
  const service = await createServiceClient();
  const normalizedScopeKey = normalizeEntitlementScopeKey(scopeKey);
  let query = service
    .from('product_entitlements')
    .select('id, user_id, product_id, scope_key, order_id, payment_key, package_id, amount, created_at')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1);

  query =
    normalizedScopeKey === 'global'
      ? query.eq('scope_key', 'global')
      : query.in('scope_key', [normalizedScopeKey, 'global']);

  const { data, error } = await query;

  if (error) {
    return null;
  }

  const row = (data as ProductEntitlementRow[] | null)?.[0] ?? null;
  return row ? mapProductTableEntitlement(row) : null;
}

export async function getProductEntitlement(
  userId: string | null | undefined,
  productId: PaidProductId,
  scopeKey: string | null = null
): Promise<ProductEntitlement | null> {
  if (!userId || !hasSupabaseServiceEnv) return null;
  return getProductTableEntitlement(userId, productId, scopeKey);
}

async function getLegacyTasteProductEntitlement(
  userId: string,
  productId: TasteProductId,
  scopeKey: string | null
) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('credit_transactions')
    .select('id, user_id, metadata, amount, created_at')
    .eq('user_id', userId)
    .eq('type', 'purchase')
    .eq('feature', 'taste_product')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const matched = (data as EntitlementTransactionRow[] | null)?.find((row) => {
    const metadata = row.metadata ?? {};
    return (
      metadata.kind === 'taste_product' &&
      metadata.productId === productId &&
      matchesProductScope(metadata, scopeKey)
    );
  });

  return matched ? mapLegacyEntitlement(matched) : null;
}

export async function getTasteProductEntitlement(
  userId: string | null | undefined,
  productId: TasteProductId,
  scopeKey: string | null = null
): Promise<TasteProductEntitlement | null> {
  if (!userId || !hasSupabaseServiceEnv) return null;

  const productTableEntitlement = await getProductEntitlement(userId, productId, scopeKey);
  if (productTableEntitlement) return productTableEntitlement as TasteProductEntitlement;

  return getLegacyTasteProductEntitlement(userId, productId, scopeKey);
}

// reading 단위로 monthly-calendar 결제가 한 번이라도 있었는지 — 어떤 (year,month) 든 무관.
// premium/page.tsx 의 분기에서 "9,900원 단독 구매자도 상세 화면" 처리를 위해 사용한다.
export async function hasAnyMonthlyCalendarForReading(
  userId: string | null | undefined,
  readingKey: string | null | undefined
): Promise<boolean> {
  if (!userId || !readingKey || !hasSupabaseServiceEnv) return false;

  // 이름 해시 드리프트 보정 — 정확 readingKey prefix(LIKE)로만 잡으면 구매(이름 있음)와
  // 열람(이름 없음)에서 readingKey 가 갈려 MISS 한다. 사주 정체성(4기둥+성별)으로 매칭한다
  // (score-total 패턴). listTaste… 는 product_entitlements + legacy credit_transactions 를 함께 본다.
  const currentIdentity = sajuIdentityFromReadingKey(readingKey);
  const scopeKeys = await listTasteProductEntitlementScopeKeys(userId, 'monthly-calendar');
  return scopeKeys.some((scopeKey) => {
    const parsed = parseMonthlyCalendarScopeKey(scopeKey);
    return parsed
      ? readingKeyMatchesCurrentSaju(parsed.readingKey, [readingKey], currentIdentity)
      : false;
  });
}

// 특정 (year, month) 의 월간달력 이용권을 사주 정체성으로 매칭 — 이름 해시 드리프트 흡수.
export async function hasMonthlyCalendarForReading(
  userId: string | null | undefined,
  readingKey: string | null | undefined,
  year: number,
  month: number
): Promise<boolean> {
  if (!userId || !readingKey || !hasSupabaseServiceEnv) return false;

  const currentIdentity = sajuIdentityFromReadingKey(readingKey);
  const scopeKeys = await listTasteProductEntitlementScopeKeys(userId, 'monthly-calendar');
  return scopeKeys.some((scopeKey) => {
    const parsed = parseMonthlyCalendarScopeKey(scopeKey);
    return (
      parsed !== null &&
      parsed.year === year &&
      parsed.month === month &&
      readingKeyMatchesCurrentSaju(parsed.readingKey, [readingKey], currentIdentity)
    );
  });
}

// year-core(올해 핵심) 이용권을 사주 정체성으로 매칭 — 이름 해시 드리프트 흡수.
//   정확 readingKey 일치 실패해도 같은 사주(4기둥+성별) + 같은 year 면 인정.
export async function hasYearCoreEntitlementForReading(
  userId: string | null | undefined,
  readingKey: string | null | undefined,
  year: number
): Promise<boolean> {
  if (!userId || !readingKey || !hasSupabaseServiceEnv) return false;

  const currentIdentity = sajuIdentityFromReadingKey(readingKey);
  const scopeKeys = await listTasteProductEntitlementScopeKeys(userId, 'year-core');
  return scopeKeys.some((scopeKey) => {
    const parsed = parseYearCoreScopeKey(scopeKey);
    return (
      parsed !== null &&
      parsed.year === year &&
      readingKeyMatchesCurrentSaju(parsed.readingKey, [readingKey], currentIdentity)
    );
  });
}

// 2026-06-22 — 사용자의 특정 taste_product 이용권 scope_key 전부 회수(product_entitlements +
//   legacy credit_transactions). 사주 정체성 매칭(reading-identity)에서 이 목록을 현재 reading 의
//   사주 정체성과 대조해 분/경로 차이를 흡수한다. 조회 실패는 비차단(빈 배열로 graceful degrade).
export async function listTasteProductEntitlementScopeKeys(
  userId: string | null | undefined,
  productId: TasteProductId
): Promise<string[]> {
  if (!userId || !hasSupabaseServiceEnv) return [];

  const service = await createServiceClient();
  const scopeKeys = new Set<string>();

  // 1) product_entitlements (정식 테이블)
  const { data: productRows } = await service
    .from('product_entitlements')
    .select('scope_key')
    .eq('user_id', userId)
    .eq('product_id', productId);
  for (const row of (productRows as { scope_key: string | null }[] | null) ?? []) {
    if (row.scope_key) scopeKeys.add(row.scope_key);
  }

  // 2) legacy credit_transactions (제약 드리프트 시절 폴백분 포함)
  const { data: legacyRows } = await service
    .from('credit_transactions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('type', 'purchase')
    .eq('feature', 'taste_product');
  for (const row of (legacyRows as { metadata: Record<string, unknown> | null }[] | null) ?? []) {
    const meta = row.metadata ?? {};
    if (
      meta.kind === 'taste_product' &&
      meta.productId === productId &&
      typeof meta.scopeKey === 'string' &&
      meta.scopeKey
    ) {
      scopeKeys.add(meta.scopeKey);
    }
  }

  return [...scopeKeys];
}

// 2026-05-24 today-detail 결제 정합성 — 같은 날(KST) today-detail 결제분 자동 인정.
//   readingKey 가 이름 해시 등으로 흔들리거나 과거 readingId(slug) scope 로 결제한
//   분이라 정확 scope 매치가 안 돼도, 본인이 그날 today-detail 을 결제했으면 그날
//   열람을 허용한다. '오늘 자세히 보기'는 (사람×날) 단위 제품이라 안전한 fallback.
export async function hasTodayDetailEntitlementForDay(
  userId: string | null | undefined,
  dayKey: string
): Promise<boolean> {
  if (!userId || !hasSupabaseServiceEnv) return false;

  const startMs = Date.parse(`${dayKey}T00:00:00+09:00`);
  if (Number.isNaN(startMs)) return false;
  const endMs = startMs + 86_400_000;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('product_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', 'today-detail')
    .gte('created_at', new Date(startMs).toISOString())
    .lt('created_at', new Date(endMs).toISOString())
    .limit(1);

  if (error) return false;
  return Boolean(data && data.length > 0);
}

async function recordLegacyTasteProductTransaction(
  userId: string,
  productId: TasteProductId,
  scopeKey: string | null,
  options: {
    orderId?: string | null;
    paymentKey?: string | null;
    amount?: number | null;
    packageId?: string | null;
  }
) {
  const service = await createServiceClient();

  if (options.paymentKey) {
    const { data, error } = await service
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'purchase')
      .eq('feature', 'taste_product')
      .contains('metadata', {
        kind: 'taste_product',
        productId,
        paymentKey: options.paymentKey,
      })
      .limit(1);

    if (error) throw new Error(error.message);
    if (data && data.length > 0) return;
  }

  const { error } = await service
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount: 0,
      type: 'purchase',
      feature: 'taste_product',
      metadata: {
        kind: 'taste_product',
        productId,
        scopeKey,
        orderId: options.orderId ?? null,
        paymentKey: options.paymentKey ?? null,
        amount: options.amount ?? null,
        packageId: options.packageId ?? null,
      },
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function grantLegacyTasteProductEntitlement(
  userId: string,
  productId: TasteProductId,
  scopeKey: string | null,
  options: {
    orderId?: string | null;
    paymentKey?: string | null;
    amount?: number | null;
    packageId?: string | null;
  }
) {
  const existing = await getLegacyTasteProductEntitlement(userId, productId, scopeKey);
  if (existing) return existing;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount: 0,
      type: 'purchase',
      feature: 'taste_product',
      metadata: {
        kind: 'taste_product',
        productId,
        scopeKey,
        orderId: options.orderId ?? null,
        paymentKey: options.paymentKey ?? null,
        amount: options.amount ?? null,
        packageId: options.packageId ?? null,
      },
    })
    .select('id, user_id, metadata, amount, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '소액 상품 이용권을 저장하지 못했습니다.');
  }

  return mapLegacyEntitlement(data as EntitlementTransactionRow);
}

export async function grantProductEntitlement(
  userId: string,
  productId: PaidProductId,
  options: {
    scopeKey?: string | null;
    orderId?: string | null;
    paymentKey?: string | null;
    amount?: number | null;
    packageId?: string | null;
  } = {}
) {
  const scopeKey = options.scopeKey ?? null;
  const normalizedScopeKey = normalizeEntitlementScopeKey(scopeKey);
  const existing = await getProductTableEntitlement(userId, productId, scopeKey);
  if (existing) return existing;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('product_entitlements')
    .insert({
      user_id: userId,
      product_id: productId,
      scope_key: normalizedScopeKey,
      order_id: options.orderId ?? null,
      payment_key: options.paymentKey ?? null,
      package_id: options.packageId ?? null,
      amount: options.amount ?? null,
      metadata: {
        kind: productId === 'lifetime-report' ? 'lifetime_report' : 'taste_product',
        productId,
        scopeKey: normalizedScopeKey,
        orderId: options.orderId ?? null,
        paymentKey: options.paymentKey ?? null,
        amount: options.amount ?? null,
        packageId: options.packageId ?? null,
      },
    })
    .select('id, user_id, product_id, scope_key, order_id, payment_key, package_id, amount, created_at')
    .single();

  if (error?.code === '23505') {
    const duplicate = await getProductTableEntitlement(userId, productId, scopeKey);
    if (duplicate) return duplicate;
  }

  if (error || !data) {
    throw new Error(error?.message ?? '상품 이용권을 저장하지 못했습니다.');
  }

  return mapProductTableEntitlement(data as ProductEntitlementRow);
}

export async function grantTasteProductEntitlement(
  userId: string,
  productId: TasteProductId,
  options: {
    scopeKey?: string | null;
    orderId?: string | null;
    paymentKey?: string | null;
    amount?: number | null;
    packageId?: string | null;
  } = {}
) {
  const scopeKey = options.scopeKey ?? null;

  let entitlement: ProductEntitlement;
  try {
    entitlement = await grantProductEntitlement(userId, productId, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('relation "product_entitlements" does not exist') ||
      message.includes('product_entitlements_product_id_check')
    ) {
      return grantLegacyTasteProductEntitlement(userId, productId, scopeKey, options);
    }
    throw error;
  }

  await recordLegacyTasteProductTransaction(userId, productId, scopeKey, options).catch((error) => {
    console.warn('taste product entitlement audit write failed', error);
  });

  return entitlement as TasteProductEntitlement;
}

/**
 * 2026-07-10 — PG 취소 통보 회수용. 주문이 실제로 지급한 이용권을 order_id 로 열거한다.
 * 지급(grantProductEntitlement)이 order_id 를 남기므로 번들이면 구성품이 여러 행으로 나온다.
 * 회수를 패키지 정의가 아니라 **실제 지급 기록**에 맞추기 위한 조회다.
 */
export async function listProductEntitlementsByOrder(
  orderId: string
): Promise<Array<{ userId: string; productId: PaidProductId; scopeKey: string | null }>> {
  if (!orderId) return [];
  const service = await createServiceClient();
  const { data, error } = await service
    .from('product_entitlements')
    .select('user_id, product_id, scope_key')
    .eq('order_id', orderId);

  if (error || !data) return [];
  return (data as Array<{ user_id: string; product_id: string; scope_key: string | null }>).map(
    (row) => ({
      userId: row.user_id,
      productId: row.product_id as PaidProductId,
      scopeKey: row.scope_key,
    })
  );
}

// 특정 사용자의 특정 상품 이용권 전체(최신순). 정확일치(scope_key)로 못 잡는 스코프를
// 후처리 매칭(예: lifetime-report 의 이름 해시 드리프트 보정)하기 위한 소스.
export async function listProductEntitlementsByProduct(
  userId: string | null | undefined,
  productId: PaidProductId
): Promise<ProductEntitlement[]> {
  if (!userId || !hasSupabaseServiceEnv) return [];
  const service = await createServiceClient();
  const { data, error } = await service
    .from('product_entitlements')
    .select('id, user_id, product_id, scope_key, order_id, payment_key, package_id, amount, created_at')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as ProductEntitlementRow[]).map(mapProductTableEntitlement);
}

export interface EntitlementRevokeQuery {
  legacyFeature: 'lifetime_report' | 'taste_product';
  legacyMatch: Record<string, unknown>;
}

// 환불 회수 시 삭제할 legacy(credit_transactions) grant 행을 특정하는 쿼리.
// grant 가 저장하는 (feature, metadata.kind, 식별자)와 정확히 대칭이어야 환불 후
// 권한이 조회에서 되살아나지 않는다(대칭은 product-entitlements.revoke.test 로 고정).
//   - lifetime-report: feature='lifetime_report', kind='lifetime_report', readingKey
//   - taste:           feature='taste_product',   kind='taste_product',   productId+scopeKey
export function resolveEntitlementRevokeQuery(
  productId: PaidProductId,
  normalizedScopeKey: string
): EntitlementRevokeQuery {
  if (productId === 'lifetime-report') {
    const readingKey = parseLifetimeReportReadingKey(normalizedScopeKey);
    return {
      legacyFeature: 'lifetime_report',
      legacyMatch: readingKey ? { kind: 'lifetime_report', readingKey } : { kind: 'lifetime_report' },
    };
  }
  return {
    legacyFeature: 'taste_product',
    legacyMatch: { kind: 'taste_product', productId, scopeKey: normalizedScopeKey },
  };
}

export interface RevokeProductEntitlementResult {
  revoked: boolean;
  productTableDeleted: number;
  legacyDeleted: number;
  paymentKey: string | null;
  amount: number | null;
}

// 환불 시 entitlement 회수. 조회 우선순위(product_entitlements → legacy
// credit_transactions)의 양쪽을 모두 제거해야 환불 후 권한이 완전히 사라진다 —
// 한쪽만 지우면 다른 경로 조회에서 권한이 되살아난다. credit_transactions.type
// CHECK 가 'refund' 를 허용하지 않아 audit 은 type='purchase' +
// feature='entitlement_revoke' + kind='entitlement_revoked' 로 남긴다(이 kind 는
// grant 조회 매칭에 걸리지 않음).
// ※ Toss 결제 취소(/v1/payments/{paymentKey}/cancel)는 이 함수 밖 — 반환된
//   paymentKey 로 호출부(admin/스크립트)가 별도 처리한다.
export async function revokeProductEntitlement(
  userId: string,
  productId: PaidProductId,
  scopeKey: string | null,
  options: {
    reason: string;
    actor?: string | null;
    paymentKey?: string | null;
  }
): Promise<RevokeProductEntitlementResult> {
  const service = await createServiceClient();
  const normalizedScopeKey = normalizeEntitlementScopeKey(scopeKey);

  // 1) product_entitlements 삭제 — 회수 전 결제 키/금액/주문번호를 audit 에 보존.
  const { data: deletedRows, error: deleteError } = await service
    .from('product_entitlements')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('scope_key', normalizedScopeKey)
    .select('payment_key, amount, order_id');

  if (deleteError) throw new Error(deleteError.message);

  const deleted =
    (deletedRows as
      | { payment_key: string | null; amount: number | null; order_id: string | null }[]
      | null) ?? [];
  const recoveredPaymentKey = options.paymentKey ?? deleted[0]?.payment_key ?? null;
  const recoveredAmount = deleted[0]?.amount ?? null;
  const recoveredOrderId = deleted[0]?.order_id ?? null;

  // 2) legacy credit_transactions grant 행 삭제 — 조회 2순위(되살아남 방지).
  const { legacyFeature, legacyMatch } = resolveEntitlementRevokeQuery(productId, normalizedScopeKey);
  const { data: legacyDeletedRows, error: legacyError } = await service
    .from('credit_transactions')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'purchase')
    .eq('feature', legacyFeature)
    .contains('metadata', legacyMatch)
    .select('id');

  if (legacyError) throw new Error(legacyError.message);
  const legacyDeleted = (legacyDeletedRows as { id: string }[] | null)?.length ?? 0;

  // 3) audit 행 — 환불 흔적 보존(실패해도 회수 자체는 유효).
  const { error: auditError } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'purchase',
    feature: 'entitlement_revoke',
    metadata: {
      kind: 'entitlement_revoked',
      productId,
      scopeKey: normalizedScopeKey,
      reason: options.reason,
      actor: options.actor ?? null,
      paymentKey: recoveredPaymentKey,
      orderId: recoveredOrderId,
      amount: recoveredAmount,
      revokedAt: new Date().toISOString(),
    },
  });
  if (auditError) console.warn('entitlement revoke audit write failed', auditError);

  return {
    revoked: deleted.length > 0 || legacyDeleted > 0,
    productTableDeleted: deleted.length,
    legacyDeleted,
    paymentKey: recoveredPaymentKey,
    amount: recoveredAmount,
  };
}

// 묶음(bundle) 결제 환불 시 구성품 entitlement 일괄 회수. revokeBundleComponents(순수,
// bundle.test 로 고정)에 실제 의존성(scope 해석·단건 회수)을 주입한 운영용 진입점.
// 운영자/admin 이 (bundlePackageId, userId, slug, reason)로 호출하면 confirm 의 grant 와
// 동일한 분해로 모든 구성품을 회수한다.
export async function revokeBundleEntitlement(
  bundlePackageId: string,
  userId: string,
  slug: string | null,
  options: { reason: string; actor?: string | null; paymentKey?: string | null }
): Promise<BundleRevokeResult[]> {
  const bundle = getPackage(bundlePackageId);
  if (!bundle || !isBundlePackage(bundle)) return [];

  return revokeBundleComponents(
    bundle,
    {
      userId,
      slug,
      reason: options.reason,
      actor: options.actor ?? null,
      paymentKey: options.paymentKey ?? null,
    },
    {
      resolveScope: (input) => resolvePaymentProductScope(input),
      revoke: (uid, productId, scopeKey, opts) =>
        revokeProductEntitlement(uid, productId, scopeKey, opts),
    }
  );
}
