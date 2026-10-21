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
}));
vi.mock('@/lib/admin/external-report', async (orig) => ({
  ...(await orig<typeof import('@/lib/admin/external-report')>()),
  generateExternalReport: vi.fn(async () => ({ data: { reportNo: 'GS-EXT-1', subjectName: '김민지' }, generationSource: 'openai' })),
  generateExternalNewYearReport: vi.fn(async () => ({ data: { reportNo: 'GS-EXT-NY27-1', subjectName: '김민지' }, generationSource: 'openai' })),
}));
vi.mock('@/lib/admin/external-report-history', () => ({ saveExternalReport: vi.fn(async () => ({ id: 'ext-1', createdAt: 'now' })) }));
vi.mock('@/lib/payments/order-ledger', () => ({ getPaymentOrderByOrderId: vi.fn(), markPaymentOrderRefunded: vi.fn() }));
vi.mock('@/lib/payments/nicepay', () => ({ cancelNicepayPayment: vi.fn(async () => ({ resultCode: '0000' })) }));
vi.mock('@/lib/report-orders/notify', () => ({ sendReportReadyMessages: vi.fn() }));

import { getCurrentAdminRole } from '@/lib/admin-auth';
import { getReportOrder, transitionReportOrder, markReportOrderRefundedByPaymentOrder } from '@/lib/report-orders/report-order-store';
import { generateExternalNewYearReport, generateExternalReport } from '@/lib/admin/external-report';
import { getPaymentOrderByOrderId, markPaymentOrderRefunded } from '@/lib/payments/order-ledger';
import { cancelNicepayPayment } from '@/lib/payments/nicepay';
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
    expect(transitionReportOrder).toHaveBeenCalledWith('r1', 'generated', expect.objectContaining({ external_report_id: 'ext-1' }));
    vi.mocked(getReportOrder).mockResolvedValueOnce({ ...baseOrder, product: 'new-year' } as never);
    await call({ action: 'generate' });
    expect(generateExternalNewYearReport).toHaveBeenCalled();
  });

  it('발송: 문자 실패·메일 성공이어도 sent, 둘 다 실패면 502 이고 상태 유지', async () => {
    vi.mocked(getReportOrder).mockResolvedValue({ ...baseOrder, status: 'generated', externalReportId: 'ext-1' } as never);
    vi.mocked(sendReportReadyMessages).mockResolvedValueOnce({ sms: false, email: true });
    expect((await call({ action: 'send' })).status).toBe(200);
    expect(transitionReportOrder).toHaveBeenCalledWith('r1', 'sent', expect.objectContaining({ reviewed_by: 'admin-1', send_result: { sms: false, email: true } }));
    vi.mocked(transitionReportOrder).mockClear();
    vi.mocked(sendReportReadyMessages).mockResolvedValueOnce({ sms: false, email: false });
    expect((await call({ action: 'send' })).status).toBe(502);
    expect(transitionReportOrder).not.toHaveBeenCalled();
  });

  it('발송은 풀이를 만든 주문만(전이 검사 전에 막음)', async () => {
    expect((await call({ action: 'send' })).status).toBe(409);
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
