// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const notFoundError = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw notFoundError; }) }));
const cookieValue = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name === 'gs_report_view' && cookieValue.token ? { value: cookieValue.token } : undefined) }) }));
vi.mock('@/lib/report-orders/report-order-store', () => ({ getReportOrderByToken: vi.fn() }));
vi.mock('@/lib/admin/external-report-history', () => ({ getExternalReport: vi.fn() }));
vi.mock('@/app/admin/external-report/report-view', () => ({
  ExternalReportView: ({ report }: { report: { data: { subjectName: string } } }) => <article data-testid="doc">{report.data.subjectName} 풀이</article>,
  externalReportPrintTitle: () => '간지사주_깊은사주풀이_김민지',
}));

import { getReportOrderByToken } from '@/lib/report-orders/report-order-store';
import { getExternalReport } from '@/lib/admin/external-report-history';
import Page, { generateMetadata } from './page';

const token = 'a'.repeat(43);
const render = async () => renderToStaticMarkup(await Page());
const sentOrder = { status: 'sent', product: 'lifetime', externalReportId: 'ext-1', purgedAt: null, name: '김민지', sentAt: new Date().toISOString() };

beforeEach(() => {
  vi.clearAllMocks();
  cookieValue.token = token;
  vi.mocked(getExternalReport).mockResolvedValue({ report: { kind: 'lifetime', data: { subjectName: '김민지' } } } as never);
});

describe('/r/view 손님 결과 화면(토큰은 쿠키로만)', () => {
  it('쿠키가 없으면 조회하지 않고 같은 404', async () => {
    cookieValue.token = undefined;
    await expect(render()).rejects.toBe(notFoundError);
    expect(getReportOrderByToken).not.toHaveBeenCalled();
  });

  it('발송된 주문이면 풀이와 PDF 저장 버튼', async () => {
    vi.mocked(getReportOrderByToken).mockResolvedValueOnce(sentOrder as never);
    const html = await render();
    expect(html).toContain('김민지 풀이');
    expect(html).toContain('PDF로 저장');
    expect(html).toContain('href="/ai-disclaimer"');
  });

  it.each([
    ['없는 토큰', null],
    ['아직 발송 전', { ...sentOrder, status: 'generated' }],
    ['보관 기간 지남', { ...sentOrder, purgedAt: '2027-10-21' }],
    ['환불됨', { ...sentOrder, status: 'refunded' }],
    ['첫 발송 1년 지남(삭제 크론이 못 돌았어도)', { ...sentOrder, sentAt: new Date(Date.now() - 366 * 86400_000).toISOString() }],
  ])('%s → 모두 같은 찾을 수 없음', async (_label, order) => {
    vi.mocked(getReportOrderByToken).mockResolvedValueOnce(order as never);
    await expect(render()).rejects.toBe(notFoundError);
  });

  it('검색 노출 금지, 공유 미리보기에 이름 없음', async () => {
    const meta = await generateMetadata();
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.referrer).toBe('no-referrer');
    expect(JSON.stringify(meta)).not.toContain('김민지');
  });
});
