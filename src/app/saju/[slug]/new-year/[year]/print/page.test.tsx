// @vitest-environment node
// 2026-09-26 — 신년운세 PDF 인쇄 페이지: 이용권 없으면 미리보기로 돌려보내고(307), 있으면 7개 장을 순서대로 그린다.
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
  redirect: vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`); }),
}));
vi.mock('@/lib/new-year-access', () => ({ resolveNewYearAccess: vi.fn() }));
vi.mock('@/server/ai/saju-yearly-service', () => ({ generateYearlyInterpretation: vi.fn() }));
vi.mock('@/components/report/report-print-actions', () => ({ ReportPrintActions: () => null }));
vi.mock('@/shared/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AppPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildYearlyReport } from '@/domain/saju/report';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';
import { buildFallbackNewYearExtras, buildFallbackYearlyInterpretation } from '@/server/ai/saju-yearly-interpretation';
import Page from './page';

const input = { year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' as const };
const reading = { userId: 'u1', input, sajuData: calculateSajuDataV1(input) };
const report = buildYearlyReport(input, reading.sajuData, 2027);
const render = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: 's1', year: '2027' }) }));

describe('신년운세 PDF 페이지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('이용권 없으면 미리보기로 보낸다', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading, hasAccess: false } as never);
    await expect(render()).rejects.toThrow('REDIRECT:/saju/s1/new-year/2027');
    expect(generateYearlyInterpretation).not.toHaveBeenCalled();
  });

  it('이용권 있으면 부가 필드까지 요청하고 7개 장을 순서대로 그린다', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading, hasAccess: true } as never);
    vi.mocked(generateYearlyInterpretation).mockResolvedValueOnce({
      report,
      interpretation: { ...buildFallbackYearlyInterpretation(report), newYear: buildFallbackNewYearExtras(report) },
    } as never);
    const html = await render();
    expect(vi.mocked(generateYearlyInterpretation).mock.calls[0][0].includeNewYear).toBe(true);
    const order = ['2027 한눈에', '총론', '분야별 운', '분기별 흐름', '월별 흐름', '기대할 일과 조심할 일', '올해의 행동 지침'];
    const positions = order.map((title) => html.indexOf(`>${title}<`));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain('가족운');
  });
});
