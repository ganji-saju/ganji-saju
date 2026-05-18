// 2026-05-18 Phase 7b — 후기 작성 시 'is_verified_purchase' 판정용.
// catalog 의 productId 를 받아 적절한 entitlement 함수를 호출한다.
import {
  getTasteProductEntitlement,
  hasAnyMonthlyCalendarForReading,
} from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import {
  isTasteProductId,
  type TasteProductId,
} from '@/lib/payments/catalog';

export async function isVerifiedPurchaseForReview(input: {
  userId: string;
  productId: string;
  scopeKey: string;
}): Promise<boolean> {
  const { userId, productId, scopeKey } = input;

  // lifetime-report — scopeKey 형식 'lifetime:{readingKey}'
  if (productId === 'lifetime-report') {
    const readingKey = scopeKey.startsWith('lifetime:')
      ? scopeKey.slice('lifetime:'.length)
      : scopeKey;
    const entitlement = await getLifetimeReportEntitlement(userId, readingKey, []);
    return Boolean(entitlement);
  }

  // monthly-calendar — 특정 월 또는 reading 전체 — readingKey 가 필요.
  if (productId === 'monthly-calendar') {
    // scopeKey 가 'calendar:{readingKey}:YYYY-MM' 형식이면 그 reading 의 monthly-calendar 가 있는지.
    if (scopeKey.startsWith('calendar:')) {
      const parts = scopeKey.split(':');
      const readingKey = parts[1] ?? '';
      if (readingKey) {
        return hasAnyMonthlyCalendarForReading(userId, readingKey);
      }
    }
    return false;
  }

  // 기타 taste_product (year-core, today-detail, love-question, money-pattern, work-flow)
  if (isTasteProductId(productId)) {
    const entitlement = await getTasteProductEntitlement(
      userId,
      productId as TasteProductId,
      scopeKey === 'global' ? null : scopeKey
    );
    return Boolean(entitlement);
  }

  return false;
}
