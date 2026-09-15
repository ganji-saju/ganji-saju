// 2026-09-15 — 막힌 경로(from=*-limit)에서 산 '오늘 자세히'만 폼 이름을 주문 metadata.subjectName 에 싣는다.
//   지급 스냅샷이 그 이름으로 굳는다(payments/fulfillment-today-detail-name.spec.ts). 무료 결과에서 온 결제에 실으면
//   같은 reading 으로 예전에 막힌 경로에서 남긴 이름이 그 실행의 이름(run)을 이긴다. DB·PG·쿠폰은 목.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTasteProductPackage } from '@/lib/payments/catalog';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } })),
}));
vi.mock('@/lib/payments/funnel-log', () => ({ logPaymentFunnelEvent: vi.fn() }));
vi.mock('@/lib/payments/provider', () => ({ getPaymentProvider: () => 'nicepay' }));
vi.mock('@/lib/payments/nicepay-config-audit', () => ({ auditNicepayKeyPair: () => ({}) }));
vi.mock('@/lib/payments/nicepay-prepare-guard', () => ({ resolveNicepayPrepareBlock: () => null }));
vi.mock('@/lib/payments/payment-origin', () => ({ buildPaymentOrigin: () => ({ env: 'production' }) }));
vi.mock('@/lib/payments/bundle', () => ({ areAllBundleComponentsOwned: vi.fn() }));
vi.mock('@/lib/payments/product-scope', () => ({
  buildPurchasedProductHref: vi.fn(),
  resolvePaymentProductScope: vi.fn(async () => ({
    productId: 'today-detail',
    slug: 'reading-dad',
    scopeKey: 'today:rk-dad',
    readingKey: 'rk-dad',
    reading: null,
  })),
}));
vi.mock('@/lib/product-entitlements', () => ({
  getTasteProductEntitlement: vi.fn(async () => null),
  hasTodayDetailEntitlementForSaju: vi.fn(async () => false),
}));
vi.mock('@/lib/report-entitlements', () => ({ getLifetimeReportEntitlement: vi.fn(async () => null) }));
vi.mock('@/lib/credits/detail-report-access', () => ({
  getKoreaAccessDay: () => '2026-09-15',
  hasDetailReportAccess: vi.fn(async () => false),
  hasTodayFortunePremiumAccess: vi.fn(async () => false),
  hasTodayFortunePremiumAccessByReading: vi.fn(async () => false),
}));
vi.mock('@/lib/subscription', () => ({ getManagedSubscription: vi.fn(async () => null) }));
vi.mock('@/lib/analytics/ga-identifiers', () => ({ readGaIdentifiers: () => ({ clientId: null, sessionId: null }) }));
vi.mock('@/lib/payments/consent', () => ({
  findMissingConsents: () => [],
  recordConsentsForPayment: vi.fn(async () => []),
}));
vi.mock('@/lib/coupons/coupon-charge', () => ({
  bindCouponClaim: vi.fn(),
  couponEnvForHost: () => 'production',
  resolveChargeForUser: vi.fn(async () => ({ listAmount: 3300, chargeAmount: 3300, claim: null, reason: null })),
}));
vi.mock('@/lib/payments/order-ledger', () => ({
  createPaymentOrder: vi.fn(async () => ({ orderId: 'order-1', amount: 3300 })),
  updatePaymentOrderPolicyVersions: vi.fn(),
}));

import { logPaymentFunnelEvent } from '@/lib/payments/funnel-log';
import { createPaymentOrder } from '@/lib/payments/order-ledger';
import { POST } from './route';

async function prepare(body: Record<string, unknown>) {
  const res = await POST(
    new NextRequest('https://ganjisaju.kr/api/payments/prepare', {
      method: 'POST',
      body: JSON.stringify({
        packageId: getTasteProductPackage('today-detail')!.id,
        product: 'today-detail',
        slug: 'reading-dad',
        scope: 'general',
        ...body,
      }),
    })
  );
  expect(res.status).toBe(200);
  expect(createPaymentOrder).toHaveBeenCalledTimes(1);
  return vi.mocked(createPaymentOrder).mock.calls[0][0].metadata as Record<string, unknown>;
}

describe('prepare — today-detail 주문의 폼 이름(subjectName)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('막힌 경로(today-fortune-limit·start-limit)면 주문 metadata 에 싣는다', async () => {
    expect(await prepare({ from: 'today-fortune-limit', subjectName: '아버지' })).toMatchObject({ subjectName: '아버지' });
    vi.clearAllMocks();
    expect(await prepare({ from: 'start-limit', subjectName: '어머니' })).toMatchObject({ subjectName: '어머니' });
  });

  it('무료 결과에서 온 결제(from 이 -limit 아님)엔 싣지 않는다 — 그 실행의 이름(run)이 정본', async () => {
    expect(await prepare({ from: 'today-fortune', subjectName: '아빠' })).not.toHaveProperty('subjectName');
  });

  it('20자로 자르고 공백뿐이면 싣지 않는다', async () => {
    expect(await prepare({ from: 'start-limit', subjectName: '가'.repeat(40) })).toMatchObject({ subjectName: '가'.repeat(20) });
    vi.clearAllMocks();
    expect(await prepare({ from: 'start-limit', subjectName: '   ' })).not.toHaveProperty('subjectName');
  });

  it('today-detail 이 아닌 상품엔 싣지 않는다', async () => {
    const metadata = await prepare({
      packageId: getTasteProductPackage('money-pattern')!.id,
      product: 'money-pattern',
      from: 'today-fortune-limit',
      subjectName: '아버지',
    });
    expect(metadata).not.toHaveProperty('subjectName');
  });

  it('이름은 주문에만 — 퍼널 로그에는 남기지 않는다', async () => {
    await prepare({ from: 'today-fortune-limit', subjectName: '아버지' });
    expect(JSON.stringify(vi.mocked(logPaymentFunnelEvent).mock.calls)).not.toContain('아버지');
  });
});
