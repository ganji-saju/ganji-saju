// @vitest-environment jsdom
// 2026-09-27 — 평생운세 화면 = PDF: 상담사 값을 보내지 않고(서버가 PDF 와 같은 규칙), 재생성 없음·다시 생성 버튼 없음.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildLifetimeReport } from '@/domain/saju/report/build-lifetime-report';
import { buildFallbackLifetimeInterpretation } from '@/server/ai/saju-lifetime-interpretation';
import LifetimeReportPanel from './lifetime-report-panel';

vi.mock('@/features/counselor/use-preferred-counselor', () => ({ usePreferredCounselor: () => ({ counselorId: 'male' }) }));
vi.mock('@/components/saju/chapter-feedback-card', () => ({ ChapterFeedbackCard: () => null }));
vi.mock('@/components/ai/grounding-kasi-summary', () => ({ GroundingKasiSummary: () => null }));

it('평생운세 패널은 상담사·재생성 없이 요청하고 다시 생성 버튼이 없다', async () => {
  const input = { year: 1982, month: 1, day: 29, hour: 8, gender: 'male' as const };
  const report = buildLifetimeReport(input, calculateSajuDataV1(input), 2026);
  const interpretation = buildFallbackLifetimeInterpretation(report);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, counselorId: 'female', report, interpretation }) });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(LifetimeReportPanel, { slug: 's1', targetYear: 2026 })); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).not.toHaveProperty('counselorId');
    expect(body.regenerate).toBe(false);
    expect(host.textContent).not.toContain('다시 생성');
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
