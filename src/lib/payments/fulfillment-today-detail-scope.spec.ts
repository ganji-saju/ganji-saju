// 2026-09-23 — 이 PR 의 핵심 이음매: **결제 지급이 날짜 scope 로 이용권을 만든다**(결제 1건 = 1행).
//   사후 검증 실측: 지급 쪽에서 날짜를 벗겨도 기존 테스트가 전부 green 이었다(product-scope 는 리졸버 출력만,
//   regrant 스펙은 scope 키를 스스로 만들어 넣는다). 그래서 여기서는 product-scope 를 **목으로 바꾸지 않고**
//   실제 리졸버 → grant 인자까지 한 번에 태운다. 자정 넘긴 재시도가 같은 scope 를 쓰는지도 같이 고정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
// reading 미해석 → readingKey = slug(실서비스의 DB 없음/미해석 경로와 같다).
vi.mock('@/lib/saju/readings', () => ({
  ensureReadingOwnedByUser: vi.fn(async (reading: unknown) => reading),
  resolveReading: vi.fn(async () => null),
  isReadingId: vi.fn(() => true),
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

import { grantTasteProductEntitlement } from '@/lib/product-entitlements';
import { fulfillPaymentOrder } from './fulfillment';

const order = (confirmedAt: string): PaymentOrder =>
  ({
    id: 'row-1',
    orderId: 'order-1',
    userId: 'user-1',
    packageId: getTasteProductPackage('today-detail')!.id,
    amount: 3300,
    currency: 'KRW',
    status: 'confirmed',
    paymentKey: 'pk-1',
    slug: 'reading-dad',
    scope: 'general',
    metadata: {},
    confirmedAt,
    createdAt: confirmedAt,
  }) as PaymentOrder;

async function fulfillAt(confirmedAt: string, systemTime: string) {
  vi.setSystemTime(new Date(systemTime));
  mocks.claimed = order(confirmedAt);
  await fulfillPaymentOrder({
    order: order(confirmedAt),
    payment: { orderId: 'order-1', paymentKey: 'pk-1', totalAmount: 3300, status: 'DONE' } as never,
    source: 'confirm' as never,
  });
  return vi.mocked(grantTasteProductEntitlement).mock.calls.at(-1)?.[2]?.scopeKey;
}

describe('today-detail 지급 — 이용권 scope 에 결제한 날(KST)이 들어간다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('결제 지급이 today:<사주>:<KST 날짜> 로 이용권을 만든다', async () => {
    // UTC 2026-09-23T02:00 = KST 11:00
    expect(await fulfillAt('2026-09-23T02:00:00.000Z', '2026-09-23T02:00:05.000Z')).toBe(
      'today:reading-dad:2026-09-23'
    );
  });

  it('자정 넘긴 지급 재시도도 **주문 시각의 날짜**를 쓴다 — 같은 결제로 행이 2개 생기지 않는다', async () => {
    // KST 23:55 결제 → 정산 크론이 KST 00:00(UTC 15:00)에 재시도
    expect(await fulfillAt('2026-09-23T14:55:00.000Z', '2026-09-23T15:00:00.000Z')).toBe(
      'today:reading-dad:2026-09-23'
    );
  });
});
