import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin-auth', () => ({ getCurrentAdminRole: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/admin/access-log', () => ({ logAdminAccess: vi.fn() }));
vi.mock('@/lib/report-orders/report-order-store', () => ({
  getReportOrder: vi.fn(),
  transitionReportOrder: vi.fn(async (_id: string, to: string) => ({ status: to })),
  markReportOrderRefundedByPaymentOrder: vi.fn(),
  recordReportOrderSendResult: vi.fn(),
}));
vi.mock('@/lib/admin/external-report', async (orig) => ({
  ...(await orig<typeof import('@/lib/admin/external-report')>()),
  generateExternalReport: vi.fn(async () => ({ data: { reportNo: 'GS-EXT-1', subjectName: '김민지' }, generationSource: 'openai' })),
  generateExternalNewYearReport: vi.fn(async () => ({ data: { reportNo: 'GS-EXT-NY27-1', subjectName: '김민지' }, generationSource: 'openai' })),
}));
vi.mock('@/lib/admin/external-report-history', () => ({ saveExternalReport: vi.fn(async () => ({ id: 'ext-new', createdAt: 'now' })), deleteExternalReport: vi.fn(async () => undefined) }));
vi.mock('@/lib/payments/order-ledger', () => ({ getPaymentOrderByOrderId: vi.fn(), markPaymentOrderRefunded: vi.fn() }));
vi.mock('@/lib/payments/nicepay', () => ({ cancelNicepayPayment: vi.fn(async () => ({ resultCode: '0000' })), getNicepayPayment: vi.fn() }));
vi.mock('@/lib/payments/fulfillment', () => ({ fulfillPaymentOrder: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/report-orders/notify', () => ({ sendReportReadyMessages: vi.fn() }));

import { getCurrentAdminRole } from '@/lib/admin-auth';
import { getReportOrder, transitionReportOrder, markReportOrderRefundedByPaymentOrder, recordReportOrderSendResult } from '@/lib/report-orders/report-order-store';
import { generateExternalNewYearReport, generateExternalReport } from '@/lib/admin/external-report';
import { deleteExternalReport } from '@/lib/admin/external-report-history';
import { getPaymentOrderByOrderId, markPaymentOrderRefunded } from '@/lib/payments/order-ledger';
import { cancelNicepayPayment, getNicepayPayment } from '@/lib/payments/nicepay';
import { fulfillPaymentOrder } from '@/lib/payments/fulfillment';
import { sendReportReadyMessages } from '@/lib/report-orders/notify';
import { POST } from './route';

const birth = {
  name: '김민지', calendarType: 'solar', timeRule: 'standard', year: '1968', month: '5', day: '17',
  hour: '2', minute: '30', unknownBirthTime: false, gender: 'female',
  birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
};
const baseOrder = {
  id: 'r1', orderNo: 'GS-R-1', product: 'lifetime', amount: 29900, payMethod: 'bank', status: 'paid',
  name: '김민지', phone: '01012345678', email: 'a@b.co', birth, paymentOrderId: null, externalReportId: null,
  resultToken: 't'.repeat(43), purgedAt: null,
};

function call(body: unknown, origin = 'https://ganjisaju.kr') {
  return POST(
    new NextRequest('https://ganjisaju.kr/api/admin/report-orders/r1', {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'r1' }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentAdminRole).mockResolvedValue({ ok: true, userId: 'admin-1', role: 'super_admin' } as never);
  vi.mocked(getReportOrder).mockResolvedValue({ ...baseOrder } as never);
});

describe('관리자 랜딩 주문 처리', () => {
  it('최고 관리자가 아니면 403', async () => {
    vi.mocked(getCurrentAdminRole).mockResolvedValueOnce({ ok: true, userId: 'a', role: 'admin' } as never);
    expect((await call({ action: 'send' })).status).toBe(403);
  });

  it('다른 출처 요청은 403', async () => {
    expect((await call({ action: 'send' }, 'https://evil.example')).status).toBe(403);
  });

  it('허용되지 않은 상태 전이는 409', async () => {
    vi.mocked(transitionReportOrder).mockRejectedValueOnce(new Error('report_order_invalid_transition'));
    expect((await call({ action: 'confirm_deposit' })).status).toBe(409);
  });

  it('입금 확인은 무통장 주문만', async () => {
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, payMethod: 'card' } as never);
    expect((await call({ action: 'confirm_deposit' })).status).toBe(400);
  });

  it('풀이 만들기: 상품에 맞는 생성기 → 기록 저장 → generated(external_report_id)', async () => {
    const res = await call({ action: 'generate' });
    expect(res.status).toBe(200);
    expect(generateExternalReport).toHaveBeenCalled();
    expect(generateExternalNewYearReport).not.toHaveBeenCalled();
    expect(transitionReportOrder).toHaveBeenCalledWith('r1', 'generated', expect.objectContaining({ external_report_id: 'ext-new' }));
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, product: 'new-year' } as never);
    await call({ action: 'generate' });
    expect(generateExternalNewYearReport).toHaveBeenCalled();
  });

  it('발송: 상태를 먼저 sent 로 잡은 뒤 보내고 결과를 기록한다(동시 두 번 눌러도 한 번만)', async () => {
    vi.mocked(getReportOrder).mockResolvedValue({ ...baseOrder, status: 'generated', externalReportId: 'ext-1' } as never);
    vi.mocked(sendReportReadyMessages).mockResolvedValueOnce({ sms: false, email: true });
    expect((await call({ action: 'send', reportId: 'ext-1' })).status).toBe(200);
    expect(transitionReportOrder).toHaveBeenCalledWith('r1', 'sent', expect.objectContaining({ reviewed_by: 'admin-1' }));
    expect(vi.mocked(transitionReportOrder).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(sendReportReadyMessages).mock.invocationCallOrder[0]);
    expect(recordReportOrderSendResult).toHaveBeenCalledWith('r1', { sms: false, email: true });
    vi.mocked(transitionReportOrder).mockRejectedValueOnce(new Error('report_order_conflict'));
    vi.mocked(sendReportReadyMessages).mockClear();
    expect((await call({ action: 'send', reportId: 'ext-1' })).status).toBe(409);
    expect(sendReportReadyMessages).not.toHaveBeenCalled();
  });

  it('발송: 둘 다 실패하면 502 + 실패 기록(다시 보내기로 해결)', async () => {
    vi.mocked(getReportOrder).mockResolvedValue({ ...baseOrder, status: 'generated', externalReportId: 'ext-1' } as never);
    vi.mocked(sendReportReadyMessages).mockResolvedValueOnce({ sms: false, email: false });
    expect((await call({ action: 'send', reportId: 'ext-1' })).status).toBe(502);
    expect(recordReportOrderSendResult).toHaveBeenCalledWith('r1', { sms: false, email: false });
  });

  it('발송: 상담사가 본 풀이(reportId)가 지금 풀이와 다르면 409, 보내지 않는다', async () => {
    vi.mocked(getReportOrder).mockResolvedValue({ ...baseOrder, status: 'generated', externalReportId: 'ext-2' } as never);
    expect((await call({ action: 'send', reportId: 'ext-1' })).status).toBe(409);
    expect(transitionReportOrder).not.toHaveBeenCalled();
    expect(sendReportReadyMessages).not.toHaveBeenCalled();
  });

  it('다시 보내기: 발송 완료 주문만, 상태·발송 시각은 그대로', async () => {
    vi.mocked(getReportOrder).mockResolvedValue({ ...baseOrder, status: 'sent', externalReportId: 'ext-1' } as never);
    vi.mocked(sendReportReadyMessages).mockResolvedValueOnce({ sms: true, email: true });
    expect((await call({ action: 'resend' })).status).toBe(200);
    expect(transitionReportOrder).not.toHaveBeenCalled();
    expect(recordReportOrderSendResult).toHaveBeenCalledWith('r1', { sms: true, email: true });
  });

  it('발송은 풀이를 만든 주문만(전이 검사 전에 막음)', async () => {
    expect((await call({ action: 'send', reportId: 'ext-1' })).status).toBe(409);
    expect(sendReportReadyMessages).not.toHaveBeenCalled();
  });

  it('카드 환불: 나이스페이 취소 → 원장 refunded → 랜딩 주문 refunded', async () => {
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, payMethod: 'card', paymentOrderId: 'ord_1', status: 'sent' } as never);
    vi.mocked(getPaymentOrderByOrderId).mockResolvedValueOnce({ orderId: 'ord_1', paymentKey: 'tid_1' } as never);
    expect((await call({ action: 'refund_card', note: '고객 요청' })).status).toBe(200);
    expect(cancelNicepayPayment).toHaveBeenCalledWith('tid_1', expect.objectContaining({ orderId: 'ord_1' }));
    expect(markPaymentOrderRefunded).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_1', source: 'admin-refund' }));
    expect(markReportOrderRefundedByPaymentOrder).toHaveBeenCalledWith('ord_1', '고객 요청');
  });

  it('카드 환불은 무통장 주문에 쓸 수 없다', async () => {
    expect((await call({ action: 'refund_card', note: 'x' })).status).toBe(400);
    expect(cancelNicepayPayment).not.toHaveBeenCalled();
  });

  it('무통장 환불 완료 표시는 메모 필수', async () => {
    expect((await call({ action: 'mark_refunded' })).status).toBe(400);
    expect((await call({ action: 'mark_refunded', note: '계좌 이체 완료' })).status).toBe(200);
  });

  it('응답에 연락처·생년월일이 없다', async () => {
    const text = await (await call({ action: 'generate' })).text();
    expect(text).not.toContain('01012345678');
    expect(text).not.toContain('1968');
  });
});

describe('카드 결제 대기 주문', () => {
  it('취소 버튼으로 막지 않는다 — 결제창에서 결제가 끝나면 돈만 받고 취소로 남는다', async () => {
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, payMethod: 'card', status: 'pending_payment', paymentOrderId: 'ord_1' } as never);
    expect((await call({ action: 'cancel' })).status).toBe(400);
    expect(transitionReportOrder).not.toHaveBeenCalled();
  });

  it('결제 확인: 나이스페이에 결제됨·금액 일치면 결제 확정을 다시 돌린다', async () => {
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, payMethod: 'card', status: 'pending_payment', paymentOrderId: 'ord_1' } as never);
    vi.mocked(getPaymentOrderByOrderId).mockResolvedValueOnce({ orderId: 'ord_1', paymentKey: 'tid_1', amount: 29900, status: 'fulfillment_failed' } as never);
    vi.mocked(getNicepayPayment).mockResolvedValueOnce({ status: 'paid', amount: 29900, tid: 'tid_1' } as never);
    expect((await call({ action: 'confirm_card' })).status).toBe(200);
    expect(fulfillPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ source: 'reconciliation' }));
  });

  it('결제 확인: 나이스페이에 결제가 없거나 금액이 다르면 409, 확정하지 않는다', async () => {
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, payMethod: 'card', status: 'pending_payment', paymentOrderId: 'ord_1' } as never);
    vi.mocked(getPaymentOrderByOrderId).mockResolvedValueOnce({ orderId: 'ord_1', paymentKey: 'tid_1', amount: 29900, status: 'confirmed' } as never);
    vi.mocked(getNicepayPayment).mockResolvedValueOnce({ status: 'paid', amount: 100, tid: 'tid_1' } as never);
    expect((await call({ action: 'confirm_card' })).status).toBe(409);
    expect(fulfillPaymentOrder).not.toHaveBeenCalled();
  });
});

describe('풀이 원본이 고아로 남지 않게', () => {
  it('다시 만들기 성공 → 이전 원본 삭제', async () => {
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, status: 'generated', externalReportId: 'ext-old' } as never);
    expect((await call({ action: 'generate' })).status).toBe(200);
    expect(deleteExternalReport).toHaveBeenCalledWith('ext-old');
  });
  it('생성 중 환불 등으로 상태가 바뀌어 저장 실패 → 방금 만든 원본 삭제', async () => {
    vi.mocked(transitionReportOrder).mockRejectedValueOnce(new Error('report_order_conflict'));
    expect((await call({ action: 'generate' })).status).toBe(409);
    expect(deleteExternalReport).toHaveBeenCalledWith('ext-new');
  });
});
