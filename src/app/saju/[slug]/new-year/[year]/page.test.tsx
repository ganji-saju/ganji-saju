// @vitest-environment node
// 2026-09-26 — 신년운세 화면: 이용권 있으면 전체 풀이 + PDF 버튼, 없으면 미리보기 + 결제 버튼.
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'ganjisaju.kr' }) }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }) }));
vi.mock('@/lib/new-year-access', () => ({ resolveNewYearAccess: vi.fn() }));
vi.mock('@/components/ai/yearly-report-panel', () => ({ default: () => <div data-testid="yearly-panel" /> }));
vi.mock('@/components/saju/entitlement-refresher', () => ({ EntitlementRefresher: () => null }));
vi.mock('@/shared/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AppPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/lib/new-year-preview-price', () => ({ resolveNewYearPreviewPrice: vi.fn(async () => ({ chargeAmount: 19900, listAmount: 19900, memberPercent: 0 })) }));

import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import Page from './page';

const input = { year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' as const };
const reading = { userId: 'u1', input, sajuData: calculateSajuDataV1(input) };
const render = async (year = '2027') =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: 's1', year }) }));

describe('신년운세 페이지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('2027 이외 연도는 notFound', async () => {
    await expect(render('2026')).rejects.toThrow('NOT_FOUND');
  });

  it('이용권 없음 → 미리보기(키워드·한 줄) + 결제 링크, 전체 패널 없음', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading, hasAccess: false, isOwner: true, loggedIn: true } as never);
    const html = await render();
    expect(html).toContain('/membership/checkout?product=new-year&amp;slug=s1');
    expect(html).toContain('19,900원');
    expect(html).not.toContain('yearly-panel');
  });

  it('이용권 있음 → 전체 패널 + PDF 저장 링크', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading, hasAccess: true, isOwner: true, loggedIn: true } as never);
    const html = await render();
    expect(html).toContain('yearly-panel');
    expect(html).toContain('/saju/s1/new-year/2027/print');
  });
});
