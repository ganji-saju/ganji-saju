import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import {
  getProductEntitlement,
  grantProductEntitlement,
  type ProductEntitlement,
} from '@/lib/product-entitlements';
import { buildLifetimeReportScopeKey } from '@/lib/payments/product-scope';

export interface LifetimeReportEntitlement {
  id: string;
  userId: string;
  readingKey: string;
  orderId: string | null;
  paymentKey: string | null;
  amount: number | null;
  createdAt: string;
}

interface EntitlementTransactionRow {
  id: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
  amount: number | null;
  created_at: string;
}

export function normalizeEntitlementReadingKeys(
  primaryKey: string,
  legacyKeys: Array<string | null | undefined> = []
) {
  const keys = [primaryKey, ...legacyKeys].map((key) => key?.trim() ?? '').filter(Boolean);
  const compatibilityKeys = keys.flatMap((key) => {
    const withoutHash = key.replace(/-key[0-9a-z]+$/i, '');
    return withoutHash === key ? [key] : [key, withoutHash];
  });

  return [...new Set(compatibilityKeys)];
}

export function matchesEntitlementReadingKey(
  candidate: unknown,
  acceptedKeys: string[]
) {
  return typeof candidate === 'string' && acceptedKeys.includes(candidate.trim());
}

function mapEntitlement(row: EntitlementTransactionRow): LifetimeReportEntitlement {
  const metadata = row.metadata ?? {};

  return {
    id: row.id,
    userId: row.user_id,
    readingKey: typeof metadata.readingKey === 'string' ? metadata.readingKey : '',
    orderId: typeof metadata.orderId === 'string' ? metadata.orderId : null,
    paymentKey: typeof metadata.paymentKey === 'string' ? metadata.paymentKey : null,
    amount: typeof metadata.amount === 'number' ? metadata.amount : row.amount,
    createdAt: row.created_at,
  };
}

function mapProductEntitlement(
  entitlement: ProductEntitlement,
  readingKey: string
): LifetimeReportEntitlement {
  return {
    id: entitlement.id,
    userId: entitlement.userId,
    readingKey,
    orderId: entitlement.orderId,
    paymentKey: entitlement.paymentKey,
    amount: entitlement.amount,
    createdAt: entitlement.createdAt,
  };
}

export async function getLifetimeReportEntitlement(
  userId: string | null | undefined,
  readingKey: string,
  legacyKeys: Array<string | null | undefined> = []
): Promise<LifetimeReportEntitlement | null> {
  if (!userId || !hasSupabaseServiceEnv) return null;

  const acceptedKeys = normalizeEntitlementReadingKeys(readingKey, legacyKeys);

  for (const acceptedKey of acceptedKeys) {
    const productEntitlement = await getProductEntitlement(
      userId,
      'lifetime-report',
      buildLifetimeReportScopeKey(acceptedKey)
    );
    if (productEntitlement) return mapProductEntitlement(productEntitlement, acceptedKey);
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from('credit_transactions')
    .select('id, user_id, metadata, amount, created_at')
    .eq('user_id', userId)
    .eq('type', 'purchase')
    .eq('feature', 'lifetime_report')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const matched = (data as EntitlementTransactionRow[] | null)?.find((row) => {
    const metadata = row.metadata ?? {};
    return (
      metadata.kind === 'lifetime_report' &&
      matchesEntitlementReadingKey(metadata.readingKey, acceptedKeys)
    );
  });

  return matched ? mapEntitlement(matched) : null;
}

async function recordLegacyLifetimeReportTransaction(
  userId: string,
  readingKey: string,
  options: {
    orderId?: string | null;
    paymentKey?: string | null;
    amount?: number | null;
  }
) {
  const service = await createServiceClient();

  if (options.paymentKey) {
    const { data, error } = await service
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'purchase')
      .eq('feature', 'lifetime_report')
      .contains('metadata', {
        kind: 'lifetime_report',
        paymentKey: options.paymentKey,
      })
      .limit(1);

    if (error) throw new Error(error.message);
    if (data && data.length > 0) return null;
  }

  const { data, error } = await service
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount: 0,
      type: 'purchase',
      feature: 'lifetime_report',
      metadata: {
        kind: 'lifetime_report',
        readingKey,
        orderId: options.orderId ?? null,
        paymentKey: options.paymentKey ?? null,
        amount: options.amount ?? null,
      },
    })
    .select('id, user_id, metadata, amount, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '깊은 사주풀이 권한을 저장하지 못했습니다.');
  }

  return mapEntitlement(data as EntitlementTransactionRow);
}

export async function grantLifetimeReportEntitlement(
  userId: string,
  readingKey: string,
  options: {
    orderId?: string | null;
    paymentKey?: string | null;
    amount?: number | null;
  } = {},
  legacyKeys: Array<string | null | undefined> = []
) {
  const existing = await getLifetimeReportEntitlement(userId, readingKey, legacyKeys);
  if (existing) return existing;

  try {
    const productEntitlement = await grantProductEntitlement(userId, 'lifetime-report', {
      scopeKey: buildLifetimeReportScopeKey(readingKey),
      orderId: options.orderId ?? null,
      paymentKey: options.paymentKey ?? null,
      amount: options.amount ?? null,
      packageId: 'lifetime_report',
    });

    await recordLegacyLifetimeReportTransaction(userId, readingKey, options).catch((error) => {
      console.warn('lifetime report entitlement audit write failed', error);
    });

    return mapProductEntitlement(productEntitlement, readingKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('relation "product_entitlements" does not exist') ||
      message.includes('product_entitlements_product_id_check') ||
      message.includes('check constraint')
    ) {
      const legacy = await recordLegacyLifetimeReportTransaction(userId, readingKey, options);
      if (legacy) return legacy;
    }
    throw error;
  }

  const fallback = await getLifetimeReportEntitlement(userId, readingKey, legacyKeys);
  if (!fallback) throw new Error('깊은 사주풀이 권한을 저장하지 못했습니다.');
  return fallback;
}
