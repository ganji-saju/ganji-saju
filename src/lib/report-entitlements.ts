import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import {
  getProductEntitlement,
  grantProductEntitlement,
  listProductEntitlementsByProduct,
  revokeProductEntitlement,
  type ProductEntitlement,
  type RevokeProductEntitlementResult,
} from '@/lib/product-entitlements';
import {
  buildLifetimeReportScopeKey,
  parseLifetimeReportReadingKey,
} from '@/lib/payments/product-scope';

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

// toSlug 의 해시 토큰(-key<hash>)만 제거 — 이름을 뺀 "같은 차트" prefix.
function stripBirthSlugHash(key: string): string {
  return key.replace(/-key[0-9a-z]+$/i, '');
}

// lifetime-report 이용권의 readingKey 매칭. 정확일치가 우선이고, 실패하면 이름 해시
// 드리프트를 흡수한다: toSlug 의 해시가 이름을 포함하므로 구매(이름 있음)와 열람(이름 없음)
// 에서 -key<hash> 가 갈린다. 같은 출생정보면 사주 차트·풀이 내용은 이름과 무관하게 동일하니
// 해시를 벗긴 prefix 가 같으면 같은 리포트로 본다. 단 해시 없는 키는 정확일치만 인정해
// 너무 짧은 prefix 로 인한 광역 오탐을 막는다(생년월일이 다르면 prefix 가 달라 매칭 안 됨).
export function lifetimeReadingKeyMatches(
  storedReadingKey: string | null | undefined,
  acceptedKeys: string[]
): boolean {
  const stored = storedReadingKey?.trim();
  if (!stored) return false;
  if (acceptedKeys.includes(stored)) return true;
  const storedPrefix = stripBirthSlugHash(stored);
  if (storedPrefix === stored) return false; // 해시 없는 키 → 정확일치만
  return acceptedKeys.some((key) => Boolean(key) && stripBirthSlugHash(key) === storedPrefix);
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

  // 이름 해시 드리프트 보정 — 정확일치가 MISS 여도 같은 차트(prefix)의 저장 이용권을 잡는다.
  //   구매(이름 있는 readingId/어드민 grant) vs 열람(이름 없는 raw slug) 조합에서 readingKey
  //   의 -key<hash> 가 갈려 "구매했는데 상세 PDF·본문이 안 보이던" 문제.
  const storedEntitlements = await listProductEntitlementsByProduct(userId, 'lifetime-report');
  for (const stored of storedEntitlements) {
    const storedReadingKey = parseLifetimeReportReadingKey(stored.scopeKey);
    if (lifetimeReadingKeyMatches(storedReadingKey, acceptedKeys)) {
      return mapProductEntitlement(stored, storedReadingKey ?? readingKey);
    }
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
      lifetimeReadingKeyMatches(
        typeof metadata.readingKey === 'string' ? metadata.readingKey : null,
        acceptedKeys
      )
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

// 49,000원 lifetime-report 환불 시 권한 회수. product_entitlements 와 legacy
// credit_transactions 양쪽에서 readingKey 단위로 제거 → 환불 후 열람 차단.
// Toss 결제 취소는 호출부가 반환된 paymentKey 로 별도 처리.
export async function revokeLifetimeReportEntitlement(
  userId: string,
  readingKey: string,
  options: { reason: string; actor?: string | null; paymentKey?: string | null }
): Promise<RevokeProductEntitlementResult> {
  return revokeProductEntitlement(
    userId,
    'lifetime-report',
    buildLifetimeReportScopeKey(readingKey),
    options
  );
}
