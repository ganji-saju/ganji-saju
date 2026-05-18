import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import type { TasteProductId } from '@/lib/payments/catalog';
import {
  buildMonthlyCalendarScopeKey,
  buildReadingProductScopeKey,
  buildTodayDetailScopeKey,
  normalizeEntitlementScopeKey,
  type PaidProductId,
} from '@/lib/payments/product-scope';

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
// premium/page.tsx 의 분기에서 "1,900원 단독 구매자도 상세 화면" 처리를 위해 사용한다.
export async function hasAnyMonthlyCalendarForReading(
  userId: string | null | undefined,
  readingKey: string | null | undefined
): Promise<boolean> {
  if (!userId || !readingKey || !hasSupabaseServiceEnv) return false;

  const scopePrefix = `calendar:${readingKey}:`;
  const service = await createServiceClient();

  // 1) product_entitlements: scope_key LIKE 'calendar:{readingKey}:%'
  const { data: productRows } = await service
    .from('product_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', 'monthly-calendar')
    .like('scope_key', `${scopePrefix}%`)
    .limit(1);
  if (productRows && productRows.length > 0) return true;

  // 2) credit_transactions legacy: feature='taste_product' + metadata.productId='monthly-calendar'
  //    + metadata.scopeKey 가 scopePrefix 로 시작.
  const { data: legacyRows } = await service
    .from('credit_transactions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('type', 'purchase')
    .eq('feature', 'taste_product')
    .order('created_at', { ascending: false });

  if (legacyRows && legacyRows.length > 0) {
    for (const row of legacyRows as { metadata: Record<string, unknown> | null }[]) {
      const meta = row.metadata ?? {};
      const scopeKey = typeof meta.scopeKey === 'string' ? meta.scopeKey : '';
      if (meta.kind === 'taste_product' && meta.productId === 'monthly-calendar' && scopeKey.startsWith(scopePrefix)) {
        return true;
      }
    }
  }

  return false;
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
