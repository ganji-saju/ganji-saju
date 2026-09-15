// 2026-09-15 — 🔴 카드로 산 가족(미등록) 사주의 '오늘 자세히'가 계정 주인 이름으로 굳던 버그.
//   지급(fulfillment)이 착지보다 먼저 스냅샷을 만들고, 착지 unlock GET 은 그 스냅샷을 그대로 돌려줘
//   거기서 넘기는 폼 이름(name)이 한 번도 쓰이지 않았다. 폼 이름은 prepare 가 주문 metadata.subjectName 에 싣고
//   (막힌 경로만 — prepare/route.spec.ts) 지급 스냅샷이 nameHint 로 넘겨야 한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTasteProductPackage } from '@/lib/payments/catalog';
import type { PaymentOrder } from '@/lib/payments/order-ledger';

const mocks = vi.hoisted(() => ({ claimed: null as unknown }));

vi.mock('@/lib/payments/order-ledger', () => ({
  validateTossPaymentAgainstOrder: vi.fn(() => ({ ok: true })),
  claimPaymentOrderFulfillment: vi.fn(async () => mocks.claimed),
  getPaymentOrderByOrderId: vi.fn(),
  markPaymentOrderFailed: vi.fn(),
  markPaymentOrderFulfilled: vi.fn(),
}));
vi.mock('@/lib/payments/product-scope', () => ({
  resolvePaymentProductScope: vi.fn(async () => ({
    productId: 'today-detail',
    slug: 'reading-dad',
    scopeKey: 'today:rk-dad',
    readingKey: 'rk-dad',
    reading: { id: 'reading-dad', userId: null, input: { year: 1962, month: 3, day: 2 } },
  })),
}));
vi.mock('@/lib/saju/readings', () => ({
  ensureReadingOwnedByUser: vi.fn(async (reading: unknown) => reading),
}));
vi.mock('@/lib/product-entitlements', () => ({
  grantTasteProductEntitlement: vi.fn(async () => ({ id: 'ent-1' })),
  getProductEntitlement: vi.fn(async () => null),
}));
vi.mock('@/lib/payments/paid-reading-snapshots', () => ({ upsertPaidReadingSnapshot: vi.fn() }));
vi.mock('@/lib/profile', () => ({ getUserProfileById: vi.fn(async () => ({ preferredCounselor: null })) }));
vi.mock('@/lib/today-fortune/result-snapshots', () => ({ upsertTodayFortuneResultSnapshot: vi.fn() }));
vi.mock('@/lib/credits/deduct', () => ({ addCredits: vi.fn(), getCredits: vi.fn() }));
vi.mock('@/lib/subscription', () => ({
  activateMembershipSubscription: vi.fn(),
  getManagedSubscription: vi.fn(),
  MEMBERSHIP_PERIOD_DAYS: 30,
}));
vi.mock('@/lib/report-entitlements', () => ({ grantLifetimeReportEntitlement: vi.fn() }));
vi.mock('@/lib/payments/bundle', () => ({ grantBundleComponents: vi.fn() }));
vi.mock('@/lib/analytics/ga-purchase-dispatch', () => ({ dispatchGaPurchase: vi.fn() }));

import { upsertTodayFortuneResultSnapshot } from '@/lib/today-fortune/result-snapshots';
import { fulfillPaymentOrder } from './fulfillment';

function order(metadata: Record<string, unknown>): PaymentOrder {
  return {
    id: 'order-row-1',
    orderId: 'order-1',
    userId: 'user-1',
    packageId: getTasteProductPackage('today-detail')!.id,
    amount: 3300,
    currency: 'KRW',
    status: 'confirmed',
    paymentKey: 'pk-1',
    slug: 'reading-dad',
    scope: 'general',
    metadata,
  } as PaymentOrder;
}

async function fulfill(metadata: Record<string, unknown>) {
  mocks.claimed = order(metadata);
  await fulfillPaymentOrder({
    order: order(metadata),
    payment: { orderId: 'order-1', paymentKey: 'pk-1', totalAmount: 3300, status: 'DONE' } as never,
    source: 'confirm' as never,
  });
  return vi.mocked(upsertTodayFortuneResultSnapshot).mock.calls[0]?.[0];
}

describe('today-detail 지급 스냅샷 — 주문에 실린 폼 이름', () => {
  beforeEach(() => vi.clearAllMocks());

  it('metadata.subjectName 을 nameHint 로 넘긴다(가족 결제가 가족 이름으로 굳는다)', async () => {
    const snapshot = await fulfill({ subjectName: '아버지' });
    expect(snapshot).toMatchObject({ sourceSessionId: 'reading-dad', nameHint: '아버지' });
  });

  it('이름이 없는 주문(무료 결과에서 온 결제 — prepare 는 막힌 경로만 싣는다)은 nameHint 없음 — 등록 가족 → run → 계정 표시명', async () => {
    const snapshot = await fulfill({ checkoutPath: '/membership/checkout' });
    expect(snapshot).toMatchObject({ sourceSessionId: 'reading-dad', nameHint: null });
  });
});
