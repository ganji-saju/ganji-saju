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

import { buildTransientReading } from '@/lib/saju/readings';
import { buildYearlyReport } from '@/domain/saju/report';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';
import { buildFallbackNewYearExtras, buildFallbackYearlyInterpretation } from '@/server/ai/saju-yearly-interpretation';
import Page from './page';

const input = { name: '검증용', year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' as const };
const reading = buildTransientReading(input, 'fixture');
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
    // 2026-09-27 사용자 피드백 — 사주팔자 명식·오행·십성이 표지와 사주 구조 쪽에 있어야 하고, 2027 흐름이 그 뒤로 이어진다.
    const order = ['네 기둥과 여덟 글자', '오행 균형', '십성과 신살', '총론과 분야별 운', '분기·월별 흐름', '기대할 일과 조심할 일', '올해의 행동 지침'];
    const positions = order.map((title) => html.indexOf(title));
    expect(positions.every((p) => p > 0), JSON.stringify(positions)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).not.toMatch(/丁未/);
    expect(html).toContain('가족운');
  });
});
