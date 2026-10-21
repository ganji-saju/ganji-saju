// 2026-10-21 — 랜딩 비회원 주문(kind 'report_order')은 이용권·전 지급이 없다. 결제 확정 = report_orders 를 paid 로.
//   승인 return 이 끊겨도 정산 크론(source 'reconciliation')이 같은 함수를 지나므로 둘 다 고정한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentOrder } from '@/lib/payments/order-ledger';

const mocks = vi.hoisted(() => ({ claimed: null as unknown }));

vi.mock('@/lib/payments/order-ledger', () => ({
  validateTossPaymentAgainstOrder: vi.fn(() => ({ ok: true })),
  claimPaymentOrderFulfillment: vi.fn(async () => mocks.claimed),
  getPaymentOrderByOrderId: vi.fn(),
  markPaymentOrderFailed: vi.fn(),
  markPaymentOrderFulfilled: vi.fn(),
}));
vi.mock('@/lib/saju/readings', () => ({ ensureReadingOwnedByUser: vi.fn(), resolveReading: vi.fn(), isReadingId: vi.fn() }));
vi.mock('@/lib/product-entitlements', () => ({ grantTasteProductEntitlement: vi.fn(), getProductEntitlement: vi.fn() }));
vi.mock('@/lib/payments/paid-reading-snapshots', () => ({ upsertPaidReadingSnapshot: vi.fn() }));
vi.mock('@/lib/profile', () => ({ getUserProfileById: vi.fn() }));
vi.mock('@/lib/today-fortune/result-snapshots', () => ({ upsertTodayFortuneResultSnapshot: vi.fn() }));
vi.mock('@/lib/credits/deduct', () => ({ addCredits: vi.fn(), getCredits: vi.fn() }));
vi.mock('@/lib/subscription', () => ({ activateMembershipSubscription: vi.fn(), getManagedSubscription: vi.fn(), MEMBERSHIP_PERIOD_DAYS: 30 }));
vi.mock('@/lib/report-entitlements', () => ({ grantLifetimeReportEntitlement: vi.fn() }));
vi.mock('@/lib/payments/bundle', () => ({ grantBundleComponents: vi.fn() }));
vi.mock('@/lib/analytics/ga-purchase-dispatch', () => ({ dispatchGaPurchase: vi.fn() }));
vi.mock('@/lib/report-orders/report-order-store', () => ({
  markReportOrderPaidByPaymentOrder: vi.fn(async () => true),
  getReportOrderByPaymentOrder: vi.fn(async () => ({ orderNo: 'GS-R-1', status: 'paid' })),
}));
vi.mock('@/lib/report-orders/notify', () => ({ sendOrderReceivedText: vi.fn() }));
vi.mock('@/lib/email/ops-alert-email', () => ({ sendOpsAlertEmail: vi.fn(async () => undefined) }));

import { addCredits } from '@/lib/credits/deduct';
import { grantTasteProductEntitlement } from '@/lib/product-entitlements';
import { ensureReadingOwnedByUser } from '@/lib/saju/readings';
import { markPaymentOrderFulfilled } from '@/lib/payments/order-ledger';
import { markReportOrderPaidByPaymentOrder } from '@/lib/report-orders/report-order-store';
import { sendOrderReceivedText } from '@/lib/report-orders/notify';
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import { fulfillPaymentOrder } from './fulfillment';

const order = { orderId: 'ord_1', userId: '', packageId: 'report_lifetime', amount: 29900, currency: 'KRW', status: 'confirmed', paymentKey: 'tid_1', slug: null, scope: null, metadata: {} } as unknown as PaymentOrder;
const payment = { orderId: 'ord_1', paymentKey: 'tid_1', totalAmount: 29900, status: 'DONE' } as never;

describe('랜딩 비회원 주문 결제 확정', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimed = order;
  });

  it.each(['nicepay-return', 'reconciliation'] as const)('%s: 지급 없이 주문을 paid 로, 결제 원장은 fulfilled, 접수 문자', async (source) => {
    const result = await fulfillPaymentOrder({ order, payment, source });
    expect(markReportOrderPaidByPaymentOrder).toHaveBeenCalledWith('ord_1');
    expect(markPaymentOrderFulfilled).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_1', source }));
    expect(sendOrderReceivedText).toHaveBeenCalledTimes(1);
    expect(addCredits).not.toHaveBeenCalled();
    expect(grantTasteProductEntitlement).not.toHaveBeenCalled();
    expect(ensureReadingOwnedByUser).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, product: null, plan: null });
  });
});

describe('결제는 됐는데 랜딩 주문을 paid 로 못 바꾼 경우(관리자가 먼저 취소 등)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimed = order;
  });
  it('조용히 넘기지 않고 운영 경보를 보낸다, 접수 문자는 보내지 않는다', async () => {
    vi.mocked(markReportOrderPaidByPaymentOrder).mockResolvedValueOnce(false);
    await fulfillPaymentOrder({ order, payment, source: 'nicepay-return' });
    expect(sendOpsAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining('랜딩 주문') }));
    expect(sendOrderReceivedText).not.toHaveBeenCalled();
  });
});
