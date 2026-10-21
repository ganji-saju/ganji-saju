import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }));

import { createServiceClient } from '@/lib/supabase/server';
import { getPackage } from '@/lib/payments/catalog';
import type { ReportOrderInput } from './parse-report-order';
import {
  createReportOrder,
  getReportOrderByToken,
  markReportOrderPaidByPaymentOrder,
  transitionReportOrder,
} from './report-order-store';

const input: ReportOrderInput = {
  product: 'lifetime', payMethod: 'bank', name: '김민지', phone: '01012345678', email: 'a@b.co', memo: '',
  cashReceipt: true,
  birth: {
    name: '김민지', calendarType: 'solar', timeRule: 'standard', year: '1968', month: '5', day: '17',
    hour: '2', minute: '30', unknownBirthTime: false, gender: 'female',
    birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
  },
};

const query = {
  insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
  single: vi.fn(), maybeSingle: vi.fn(),
};
const service = { from: vi.fn(() => query) };
const dbRow = (patch: Record<string, unknown> = {}) => ({
  id: 'r1', order_no: 'GS-R-261021-ABCD', product: 'lifetime', amount: 29900, pay_method: 'bank',
  status: 'awaiting_deposit', name: '김민지', phone: '01012345678', email: 'a@b.co', birth_input: input.birth,
  memo: '', cash_receipt: true, payment_order_id: null, external_report_id: null, result_token: 't'.repeat(43),
  deposit_due_at: null, created_at: '2026-10-21T00:00:00Z', ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceClient).mockResolvedValue(service as never);
  query.single.mockResolvedValue({ data: dbRow(), error: null });
  query.maybeSingle.mockResolvedValue({ data: dbRow(), error: null });
});

describe('카탈로그', () => {
  it('랜딩 상품 2종: 정가 취소선 값과 판매가', () => {
    expect(getPackage('report_lifetime')).toMatchObject({ price: 29900, compareAt: 60000, kind: 'report_order', credits: 0 });
    expect(getPackage('report_new_year')).toMatchObject({ price: 19900, compareAt: 40000, kind: 'report_order', credits: 0 });
  });
});

describe('createReportOrder', () => {
  it('무통장은 입금 대기 + 3일 기한, 추측 불가 토큰을 만든다', async () => {
    const now = new Date('2026-10-21T00:00:00Z');
    await createReportOrder({ ...input, amount: 29900, paymentOrderId: null, source: null }, { now });
    const row = query.insert.mock.calls[0][0];
    expect(row.status).toBe('awaiting_deposit');
    expect(row.deposit_due_at).toBe('2026-10-24T00:00:00.000Z');
    expect(row.result_token.length).toBeGreaterThanOrEqual(43);
    expect(row.order_no).toMatch(/^GS-R-261021-[A-Z0-9]{4}$/);
    expect(row.birth_input).toEqual(input.birth);
  });

  it('카드는 결제 대기, 입금 기한 없음, 결제 주문번호 연결', async () => {
    await createReportOrder({ ...input, payMethod: 'card', amount: 29900, paymentOrderId: 'ord_x', source: 'insta' });
    const row = query.insert.mock.calls[0][0];
    expect(row).toMatchObject({ status: 'pending_payment', deposit_due_at: null, payment_order_id: 'ord_x', source: 'insta' });
  });
});

describe('transitionReportOrder', () => {
  it('허용되지 않은 전이는 DB 를 건드리지 않고 거부', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: dbRow({ status: 'sent' }), error: null });
    await expect(transitionReportOrder('r1', 'paid')).rejects.toThrow('report_order_invalid_transition');
    expect(query.update).not.toHaveBeenCalled();
  });

  it('현재 상태 조건으로 갱신해 동시 처리 경합을 막는다', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: dbRow({ status: 'awaiting_deposit' }), error: null });
    query.maybeSingle.mockResolvedValueOnce({ data: dbRow({ status: 'paid' }), error: null });
    await transitionReportOrder('r1', 'paid', { deposit_confirmed_by: 'admin' });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', deposit_confirmed_by: 'admin' }));
    expect(query.eq).toHaveBeenCalledWith('status', 'awaiting_deposit');
  });
});

describe('markReportOrderPaidByPaymentOrder', () => {
  it('결제 대기 주문만 paid 로 바꾼다(멱등)', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await markReportOrderPaidByPaymentOrder('ord_x');
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }));
    expect(query.eq).toHaveBeenCalledWith('payment_order_id', 'ord_x');
    expect(query.eq).toHaveBeenCalledWith('status', 'pending_payment');
  });
});

describe('getReportOrderByToken', () => {
  it('형식이 틀린 토큰은 조회하지 않는다', async () => {
    await expect(getReportOrderByToken('short')).resolves.toBeNull();
    expect(service.from).not.toHaveBeenCalled();
  });
});
