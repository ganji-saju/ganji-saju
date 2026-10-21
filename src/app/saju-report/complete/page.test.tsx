// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/report-orders/report-order-store', () => ({ getReportOrderByPaymentOrder: vi.fn() }));
import { getReportOrderByPaymentOrder } from '@/lib/report-orders/report-order-store';
import Page from './page';

const render = async (order?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(order ? { order } : {}) }));

describe('/saju-report/complete', () => {
  it('결제된 주문이면 주문번호와 전달 안내, 개인정보는 없음', async () => {
    vi.mocked(getReportOrderByPaymentOrder).mockResolvedValueOnce({ orderNo: 'GS-R-261021-ABCD', status: 'paid', name: '김민지', phone: '01012345678' } as never);
    const html = await render('ord_7f3a9c');
    expect(html).toContain('결제가 완료됐어요');
    expect(html).toContain('GS-R-261021-ABCD');
    expect(html).toContain('영업일 1~2일');
    expect(html).not.toContain('01012345678');
  });

  it('주문을 못 찾거나 아직 결제 전이면 확인 중 안내', async () => {
    vi.mocked(getReportOrderByPaymentOrder).mockResolvedValueOnce(null);
    expect(await render('ord_x')).toContain('결제를 확인하고 있어요');
    expect(await render()).toContain('결제를 확인하고 있어요');
  });
});
