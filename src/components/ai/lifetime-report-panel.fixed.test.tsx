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


it('실제 단계 이벤트로 게이지를 갱신하고 끊긴 스트림은 오류 처리한 뒤 재시도에서 0으로 시작한다', async () => {
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({ start(c) { streamController = c; } });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/x-ndjson' }), body: stream });
  vi.stubGlobal('fetch', fetchMock);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(LifetimeReportPanel, { slug: 's1', targetYear: 2026 })); });
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    // Network chunks can split Korean UTF-8 bytes as well as JSON lines.
    const bytes = encoder.encode(JSON.stringify({ type: 'progress', percent: 40, label: '성향 정리 완료' }) + '\n');
    await act(async () => { streamController.enqueue(bytes.slice(0, 57)); });
    await act(async () => { streamController.enqueue(bytes.slice(57)); });
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');
    expect(host.textContent).toContain('성향 정리 완료');
    await act(async () => { streamController.close(); });
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    expect(host.textContent).toContain('불러오기 실패');
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => { host.querySelector('button')!.click(); });
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});


it('스트림의 최종 결과를 받으면 게이지를 닫고 풀이를 표시한다', async () => {
  const input = { year: 1982, month: 1, day: 29, hour: 8, gender: 'male' as const };
  const report = buildLifetimeReport(input, calculateSajuDataV1(input), 2026);
  const payload = { ok: true, counselorId: 'female', report, interpretation: buildFallbackLifetimeInterpretation(report) };
  const body = new ReadableStream<Uint8Array>({ start(c) {
    c.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'progress', percent: 90, label: '마무리 중' }) + '\n' + JSON.stringify({ type: 'result', payload }) + '\n'));
    c.close();
  } });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/x-ndjson' }), body }));
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(LifetimeReportPanel, { slug: 's1', targetYear: 2026 })); });
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    expect(host.textContent).not.toContain('불러오기 실패');
    expect(host.textContent).toContain(report.wealthStyle.earningStyle);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
