// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildLifetimeReport } from '@/domain/saju/report/build-lifetime-report';
import { buildFallbackLifetimeInterpretation } from '@/server/ai/saju-lifetime-interpretation';
import LifetimeReportPanel from './lifetime-report-panel';

vi.mock('@/features/counselor/use-preferred-counselor', () => ({ usePreferredCounselor: () => ({ counselorId: 'female' }) }));
vi.mock('@/components/saju/chapter-feedback-card', () => ({ ChapterFeedbackCard: () => null }));
vi.mock('@/components/ai/grounding-kasi-summary', () => ({ GroundingKasiSummary: () => null }));

it('핵심 질문의 생활 장면과 마지막 선택 기준을 두 문장 뒤에서도 끝까지 표시한다', async () => {
  const input = { year: 1982, month: 1, day: 29, hour: 8, gender: 'male' as const };
  const report = buildLifetimeReport(input, calculateSajuDataV1(input), 2026);
  report.wealthStyle.earningStyle = '첫 번째 설명입니다. 두 번째 근거입니다. 세 번째 생활 장면입니다. 마지막에는 계약 범위를 직접 확인하세요.';
  const interpretation = buildFallbackLifetimeInterpretation(report);
  interpretation.sections.wealthStyle = '신강은 자기 기준을 밀고 나가는 힘을 살피는 말입니다. 정관과 편관의 차이를 함께 확인합니다.';
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, counselorId: 'female', report, interpretation }) }));
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(LifetimeReportPanel, { slug: 'sample', targetYear: 2026 })); });
    expect(host.textContent).toContain('어떤 방식으로 돈을 벌 때 강점이 드러날까요?');
    expect(host.textContent).toContain('세 번째 생활 장면입니다. 마지막에는 계약 범위를 직접 확인하세요.');
    expect(host.textContent).toContain('신강은 자기 기준을 밀고 나가는 힘을 살피는 말입니다.');
    expect(host.textContent).toContain('정관과 편관의 차이를 함께 확인합니다.');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
