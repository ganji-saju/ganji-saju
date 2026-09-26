// @vitest-environment jsdom
// 2026-09-27 — 신년운세 화면(mode="new-year"): PDF 와 같은 풀이를 보여야 한다(사용자: "볼 때마다 내용이 다르면 실망").
//   상담사 값을 보내지 않고(서버가 PDF 와 같은 규칙으로 고름), 다시 생성 버튼이 없고, 풀이를 만드는 동안 진행 로딩을 띄운다.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildYearlyReport } from '@/domain/saju/report';
import { buildFallbackYearlyInterpretation } from '@/server/ai/saju-yearly-interpretation';
import YearlyReportPanel from './yearly-report-panel';

vi.mock('@/features/counselor/use-preferred-counselor', () => ({ usePreferredCounselor: () => ({ counselorId: 'male' }) }));
vi.mock('@/components/gangi/gangi-ui', () => ({
  GangiLoadingOverlay: ({ title }: { title: string }) => createElement('div', { 'data-testid': 'overlay' }, title),
}));

it('신년운세 모드: 상담사·재생성 없이 한 번만 요청하고, 기다리는 동안 진행 로딩, 다시 생성 버튼 없음', async () => {
  const input = { year: 1982, month: 1, day: 29, hour: 8, gender: 'male' as const };
  const report = buildYearlyReport(input, calculateSajuDataV1(input), 2027);
  const interpretation = buildFallbackYearlyInterpretation(report);
  let resolve!: (v: unknown) => void;
  const fetchMock = vi.fn(() => new Promise((r) => { resolve = r; }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(YearlyReportPanel, { slug: 's1', targetYear: 2027, mode: 'new-year' })); });
    expect(host.querySelector('[data-testid="overlay"]')?.textContent).toContain('2027');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).not.toHaveProperty('counselorId');
    expect(body.regenerate).toBe(false);
    await act(async () => { resolve({ ok: true, json: async () => ({ ok: true, targetYear: 2027, counselorId: 'female', report, interpretation }) }); });
    expect(host.textContent).not.toContain('다시 생성');
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
