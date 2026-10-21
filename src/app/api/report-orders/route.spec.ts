import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/report-orders/report-order-store', () => ({ createReportOrder: vi.fn() }));
vi.mock('@/lib/payments/order-ledger', () => ({ createPaymentOrder: vi.fn() }));
vi.mock('@/lib/payments/price-resolver', () => ({ resolvePackagePrice: vi.fn() }));
vi.mock('@/lib/report-orders/notify', () => ({ sendOrderReceivedText: vi.fn() }));
vi.mock('@/lib/payments/funnel-log', () => ({ logPaymentFunnelEvent: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));

import { createReportOrder } from '@/lib/report-orders/report-order-store';
import { createPaymentOrder } from '@/lib/payments/order-ledger';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { POST } from './route';
import { resetReportOrderRateLimitForTest } from '@/lib/report-orders/rate-limit';

const form = {
  product: 'lifetime', payMethod: 'card', name: '김민지', phone: '010-1234-5678', email: 'a@b.co', memo: '',
  cashReceipt: false, gender: 'female', calendarType: 'solar', year: '1968', month: '5', day: '17',
  hourSlot: 'chuk', consentPrivacy: true, consentTerms: true, amount: 1,
};

function request(body: unknown, headers: Record<string, string> = {}, ip = '1.1.1.1') {
  return new NextRequest('https://ganjisaju.kr/api/report-orders', {
    method: 'POST',
    headers: { origin: 'https://ganjisaju.kr', 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetReportOrderRateLimitForTest();
  vi.stubEnv('REPORT_BANK_NAME', '국민은행');
  vi.stubEnv('REPORT_BANK_ACCOUNT', '123-45-6789');
  vi.stubEnv('REPORT_BANK_HOLDER', '푸꼬컴퍼니');
  vi.mocked(resolvePackagePrice).mockResolvedValue(29900);
  vi.mocked(createPaymentOrder).mockResolvedValue({ orderId: 'ord_1', amount: 29900 } as never);
  vi.mocked(createReportOrder).mockImplementation(async (input) => ({
    id: 'r1', orderNo: 'GS-R-261021-ABCD', amount: input.amount, payMethod: input.payMethod,
    depositDueAt: input.payMethod === 'bank' ? '2026-10-24T00:00:00.000Z' : null,
  }) as never);
});

describe('POST /api/report-orders', () => {
  it('다른 출처 요청은 403', async () => {
    const res = await POST(request(form, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });

  it('8KB 넘는 본문은 400', async () => {
    const res = await POST(request({ ...form, memo: 'a'.repeat(9000) }));
    expect(res.status).toBe(400);
  });

  it('검증 실패는 400 + 안내 문구', async () => {
    const res = await POST(request({ ...form, phone: '123' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: '휴대폰 번호를 확인해 주세요.' });
  });

  it('카드: 서버 가격으로 비회원 결제 주문을 만들고 결제창 정보를 돌려준다(본문 금액 무시)', async () => {
    const res = await POST(request(form));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(createPaymentOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: null, listAmount: 29900 }));
    expect(vi.mocked(createPaymentOrder).mock.calls[0][0].pkg.id).toBe('report_lifetime');
    expect(createReportOrder).toHaveBeenCalledWith(expect.objectContaining({ paymentOrderId: 'ord_1', amount: 29900 }));
    expect(body).toEqual({ ok: true, payMethod: 'card', orderId: 'ord_1', amount: 29900, goodsName: '종합사주 1인' });
    expect(JSON.stringify(body)).not.toContain('김민지');
  });

  it('무통장: 계좌 안내를 돌려주고 결제 원장은 만들지 않는다', async () => {
    const res = await POST(request({ ...form, payMethod: 'bank' }));
    expect(await res.json()).toEqual({
      ok: true, payMethod: 'bank', orderNo: 'GS-R-261021-ABCD', amount: 29900,
      bank: '국민은행', account: '123-45-6789', holder: '푸꼬컴퍼니', depositDueAt: '2026-10-24T00:00:00.000Z',
    });
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });

  it('무통장 계좌 설정이 없으면 400', async () => {
    vi.stubEnv('REPORT_BANK_ACCOUNT', '');
    const res = await POST(request({ ...form, payMethod: 'bank' }));
    expect(res.status).toBe(400);
  });

  it('같은 IP 10분에 5건을 넘으면 429', async () => {
    for (let i = 0; i < 5; i += 1) expect((await POST(request(form))).status).toBe(200);
    expect((await POST(request(form))).status).toBe(429);
    expect((await POST(request(form, {}, '2.2.2.2'))).status).toBe(200);
  });
});
