import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

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
  return [...new Set([primaryKey, ...legacyKeys].map((key) => key?.trim() ?? '').filter(Boolean))];
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

export async function getLifetimeReportEntitlement(
  userId: string | null | undefined,
  readingKey: string,
  legacyKeys: Array<string | null | undefined> = []
): Promise<LifetimeReportEntitlement | null> {
  if (!userId || !hasSupabaseServiceEnv) return null;

  const acceptedKeys = normalizeEntitlementReadingKeys(readingKey, legacyKeys);
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

  const service = await createServiceClient();
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
