// 2026-09-14 — 멤버십 일부 환불(사용자 결정 나): 주문 단위 요청이 금액을 받고(0 < 금액 ≤ 주문금액, 멤버십만) → 승인이 cancelAmt 부분취소 →
//   완료 뒤 PG 응답 cancels[] 의 새 취소 거래로 applyPartialRefund(나중 partialCancelled 통보와 같은 거래라 1회). 잔액 0 이면 전액 경로.
//   샌드박스는 부분취소를 U128 로 거절한다 — 거절 사유(코드 포함)가 화면으로 간다. DB·PG·원장은 목.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const db = vi.hoisted(() => ({
  order: null as null | Record<string, unknown>,
  request: null as null | Record<string, unknown>,
  inserted: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/supabase/server', () => {
  const from = (table: string) => {
    let mode = 'select';
    let payload: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      insert: (row: Record<string, unknown>) => ((mode = 'insert'), (payload = row), chain),
      update: (patch: Record<string, unknown>) => ((mode = 'update'), (payload = patch), chain),
      maybeSingle: async () => ({ data: table === 'payment_orders' ? db.order : db.request, error: null }),
      single: async () => {
        db.inserted.push(payload);
        return { data: { id: 'rr_new' }, error: null };
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        if (mode === 'update' && table === 'refund_requests' && db.request) Object.assign(db.request, payload);
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    });
    return chain;
  };
  return { createClient: vi.fn(async () => ({})), createServiceClient: vi.fn(async () => ({ from })) };
});
vi.mock('@/lib/admin-auth', () => ({
  getCurrentAdminRole: vi.fn(async () => ({ ok: true, userId: 'admin-1', role: 'super_admin' })),
}));
vi.mock('@/lib/payments/nicepay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payments/nicepay')>()),
  cancelNicepayPayment: vi.fn(),
  getNicepayPayment: vi.fn(),
}));
vi.mock('@/lib/payments/toss', () => ({ cancelPayment: vi.fn(), getPayment: vi.fn() }));
vi.mock('@/lib/payments/order-ledger', () => ({
  getOrderProviderByPaymentKey: vi.fn(async () => 'nicepay'),
  getPaymentOrderByPaymentKey: vi.fn(async () => ({
    orderId: 'ord_m',
    packageId: db.order?.package_id,
    status: 'fulfilled',
    confirmedAt: '2026-09-01T00:00:00.000Z',
    fulfilledAt: '2026-09-01T00:00:01.000Z',
  })),
  markPaymentOrderRefunded: vi.fn(async () => ({})),
  applyPartialRefund: vi.fn(async () => 'applied'),
}));
vi.mock('@/lib/product-entitlements', () => ({ revokeEntitlementsOfPayment: vi.fn(async () => ({ revoked: false })) }));
vi.mock('@/lib/credits/refunds', () => ({ revokeCreditPurchaseLots: vi.fn() }));
vi.mock('@/lib/admin/credit-lots', () => ({ loadPurchaseCreditLots: vi.fn() }));

import { cancelNicepayPayment, getNicepayPayment } from '@/lib/payments/nicepay';
import { applyPartialRefund, markPaymentOrderRefunded } from '@/lib/payments/order-ledger';
import { POST } from './route';

const MEMBERSHIP_ORDER = {
  id: 'row_m',
  user_id: 'u1',
  order_id: 'ord_m',
  package_id: 'membership_premium',
  amount: 49000,
  status: 'fulfilled',
  payment_key: 'tid_m',
  slug: null,
};

function call(body: Record<string, unknown>) {
  return POST(
    new NextRequest('https://ganjisaju.kr/api/admin/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}
const request = (amount?: unknown) =>
  call({ action: 'request', kind: 'product', bundleOrderId: 'row_m', reason: '고객 요청', ...(amount !== undefined ? { amount } : {}) });

beforeEach(() => {
  db.order = { ...MEMBERSHIP_ORDER };
  db.request = null;
  db.inserted.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('관리자 주문 단위 환불 요청 — 일부 환불 금액', () => {
  it.each([0, -1, 49001, 1.5, 'abc'])('금액 %s 는 거부(0 < 금액 ≤ 주문금액 정수)', async (amount) => {
    const res = await request(amount);
    expect(res.status).toBe(400);
    expect(db.inserted).toHaveLength(0);
  });

  it('멤버십 일부 환불은 요청 스냅샷에 금액·원결제액을 남긴다 · 비우면 전액', async () => {
    expect((await request(24500)).status).toBe(200);
    expect(db.inserted[0]).toMatchObject({ amount: 24500, original_amount: 49000, refund_metadata: expect.objectContaining({ partial: true }) });
    expect((await request('')).status).toBe(200);
    expect(db.inserted[1]).toMatchObject({ amount: 49000, original_amount: 49000, refund_metadata: expect.objectContaining({ partial: false }) });
  });

  it('멤버십이 아닌 주문의 일부 환불은 거부(회수가 결제키 전부라 부분 금액에 이용권을 다 거둔다)', async () => {
    db.order = { ...MEMBERSHIP_ORDER, package_id: 'taste_dialogue_entry', amount: 3300 };
    const res = await request(1000);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: '일부 환불은 멤버십 주문만 됩니다.' });
    expect((await request(3300)).status).toBe(200);
  });
});

describe('관리자 일부 환불 승인·실행', () => {
  const approve = () => call({ action: 'approve', requestId: 'rr1' });
  beforeEach(() => {
    db.request = {
      id: 'rr1',
      status: 'requested',
      refund_kind: 'product',
      payment_key: 'tid_m',
      idempotency_key: 'idem',
      user_id: 'u1',
      product_id: 'membership_premium',
      scope_key: null,
      amount: 24500,
      original_amount: 49000,
      credit_amount: null,
      credit_transaction_id: null,
      reason: '고객 요청',
    };
  });

  it('cancelAmt 부분취소 → 응답 cancels[] 의 새 거래 tid·금액으로 applyPartialRefund(전액 표기 없음)', async () => {
    vi.mocked(cancelNicepayPayment).mockResolvedValue({
      resultCode: '0000',
      status: 'partialCancelled',
      balanceAmt: 24500,
      cancelledTid: 'ctid_2',
      cancels: [
        { tid: 'ctid_1', amount: 1000 },
        { tid: 'ctid_2', amount: 24500 },
      ],
    });
    const body = await (await approve()).json();
    expect(body).toMatchObject({ ok: true, status: 'completed', error: null });
    expect(cancelNicepayPayment).toHaveBeenCalledWith('tid_m', expect.objectContaining({ cancelAmt: 24500, orderId: 'ord_m' }));
    expect(applyPartialRefund).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_m', cancelTid: 'ctid_2', amount: 24500, source: 'admin-refund' }));
    expect(markPaymentOrderRefunded).not.toHaveBeenCalled();
  });

  it('부분취소로 잔액이 0 이 됐으면(cancelled) 전액 경로(markPaymentOrderRefunded)', async () => {
    vi.mocked(cancelNicepayPayment).mockResolvedValue({ resultCode: '0000', status: 'cancelled', balanceAmt: 0, cancels: [{ tid: 'ctid_1', amount: 24500 }] });
    await approve();
    expect(markPaymentOrderRefunded).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_m', source: 'admin-refund' }));
    expect(applyPartialRefund).not.toHaveBeenCalled();
  });

  it('응답에 취소 거래가 없으면 기간을 추정으로 줄이지 않고 사유를 화면으로', async () => {
    vi.mocked(cancelNicepayPayment).mockResolvedValue({ resultCode: '0000', status: 'partialCancelled', balanceAmt: 24500 });
    const body = await (await approve()).json();
    expect(body.status).toBe('completed');
    expect(body.error).toMatch(/취소 거래가 없어/);
    expect(applyPartialRefund).not.toHaveBeenCalled();
  });

  it.each([
    ['failed', /기간 줄이기 실패/],
    ['missing', /대상 없음/],
  ])('원장 결과 %s 는 화면 사유로(완료는 그대로)', async (outcome, message) => {
    vi.mocked(cancelNicepayPayment).mockResolvedValue({ resultCode: '0000', status: 'partialCancelled', balanceAmt: 24500, cancels: [{ tid: 'ctid_1', amount: 24500 }] });
    vi.mocked(applyPartialRefund).mockResolvedValueOnce(outcome as 'failed');
    const body = await (await approve()).json();
    expect(body.status).toBe('completed');
    expect(body.error).toMatch(message);
  });

  it('재승인(failed) — PG 가 첫 승인의 부분취소를 이미 처리했으면 새 취소 없이 완료하고 그 거래로 기간을 줄인다(이중 환불 방지)', async () => {
    Object.assign(db.request!, { status: 'failed', created_at: '2026-09-14T01:00:00.000Z' });
    vi.mocked(getNicepayPayment).mockResolvedValue({
      resultCode: '0000',
      status: 'partialCancelled',
      balanceAmt: 24500,
      cancels: [{ tid: 'ctid_lost', amount: 24500, cancelledAt: '2026-09-14T10:05:00.000+0900' }],
    });
    const body = await (await approve()).json();
    expect(body).toMatchObject({ ok: true, status: 'completed', error: null });
    expect(cancelNicepayPayment).not.toHaveBeenCalled();
    expect(applyPartialRefund).toHaveBeenCalledWith(expect.objectContaining({ cancelTid: 'ctid_lost', amount: 24500 }));
    expect(markPaymentOrderRefunded).not.toHaveBeenCalled();
  });

  it('샌드박스 부분취소 거절(U128)은 failed + 사유(코드 포함)가 화면으로 · 원장 무변경', async () => {
    vi.mocked(cancelNicepayPayment).mockRejectedValue(Object.assign(new Error('부분취소는 운영 환경에서 이용 가능합니다.'), { resultCode: 'U128' }));
    const body = await (await approve()).json();
    expect(body).toMatchObject({ ok: false, status: 'failed', error: '부분취소는 운영 환경에서 이용 가능합니다. (U128)' });
    expect(db.request!.error_message).toBe('부분취소는 운영 환경에서 이용 가능합니다. (U128)');
    expect(applyPartialRefund).not.toHaveBeenCalled();
    expect(markPaymentOrderRefunded).not.toHaveBeenCalled();
  });
});
