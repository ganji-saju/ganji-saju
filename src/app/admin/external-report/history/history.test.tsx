// @vitest-environment jsdom
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExternalReportHistoryPage from './page';
import SavedExternalReportPage from './[id]/page';
import { HistoryPrintButton } from './history-print-button';

const mocks = vi.hoisted(() => ({ guard: vi.fn(), list: vi.fn(), get: vi.fn(), report: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ getCurrentAdminRole: mocks.guard }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/admin/external-report-history', () => ({ listExternalReports: mocks.list, getExternalReport: mocks.get }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  notFound: () => { throw new Error('not-found'); },
}));
vi.mock('@/components/report/report-document', () => ({
  ReportDocument: (props: unknown) => { mocks.report(props); return <article>저장된 보고서</article>; },
}));

const saved = {
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-09-17T16:20:00.000Z',
  reportNo: 'GS-EXT-20260918-12345678',
  subjectName: '테스트고객',
  birth: {
    name: '테스트고객', calendarType: 'lunar', year: '1990', month: '5', day: '15',
    gender: 'female', unknownBirthTime: false, hour: '9', minute: '0', timeRule: 'trueSolarTime',
    birthLocationCode: 'custom', birthLocationLabel: '성남시', birthLatitude: '37.4201', birthLongitude: '127.1265',
  },
  generationSource: 'fallback',
  report: {
    data: { subjectName: '테스트고객', savedNarrative: '저장 당시 풀이' },
    issuedAt: '2026.09.18', generationSource: 'fallback', generationWarning: '저장된 생성 경고',
  },
};
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let fontsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.guard.mockReset().mockResolvedValue({ ok: true, role: 'super_admin' });
  mocks.list.mockReset().mockResolvedValue({ items: [saved], hasMore: true, page: 2 });
  mocks.get.mockReset().mockResolvedValue(saved);
  mocks.report.mockReset();
  fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor);
  else Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('관리자 PDF 생성 기록', () => {
  it.each([
    { ok: false, role: null },
    { ok: true, role: 'admin' },
  ])('최고 관리자 외에는 목록과 상세를 조회하기 전에 차단한다: %j', async (guard) => {
    mocks.guard.mockResolvedValue(guard);
    await expect(ExternalReportHistoryPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/admin');
    await expect(SavedExternalReportPage({ params: Promise.resolve({ id: saved.id }) })).rejects.toThrow('redirect:/admin');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('원본 사주 정보와 KST 생성 날짜, 재다운로드 링크 및 페이지 이동을 표시한다', async () => {
    const html = renderToStaticMarkup(await ExternalReportHistoryPage({ searchParams: Promise.resolve({ page: '2' }) }));
    expect(mocks.list).toHaveBeenCalledWith(2);
    for (const value of ['테스트고객', '1990.05.15', '음력 평달', '여성', '09:00', '진태양시', '성남시', '37.4201', '127.1265', '2026-09-18 01:20', '기본 계산 풀이', 'PDF 재다운로드']) {
      expect(html).toContain(value);
    }
    expect(html).toContain(`href="/admin/external-report/history/${saved.id}"`);
    expect(html).toContain('/admin/external-report/history?page=1');
    expect(html).toContain('/admin/external-report/history?page=3');
  });

  it('빈 목록에는 안내를 표시하고 잘못된 페이지 문자열은 첫 페이지로 처리한다', async () => {
    mocks.list.mockResolvedValue({ items: [], hasMore: false, page: 1 });
    const html = renderToStaticMarkup(await ExternalReportHistoryPage({ searchParams: Promise.resolve({ page: 'invalid' }) }));
    expect(mocks.list).toHaveBeenCalledWith(1);
    expect(html).toContain('아직 저장된 PDF 생성 기록이 없습니다.');
    expect(html).not.toContain('page=2');
  });

  it('분을 입력하지 않은 원본 정보는 00분으로 바꾸지 않고 분 미입력으로 표시한다', async () => {
    mocks.list.mockResolvedValue({ items: [{ ...saved, birth: { ...saved.birth, minute: '' } }], hasMore: false, page: 1 });
    const html = renderToStaticMarkup(await ExternalReportHistoryPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('09시 · 분 미입력 · 진태양시');
    expect(html).not.toContain('09:00');
  });

  it('목록 조회 장애를 빈 목록으로 표시하지 않는다', async () => {
    mocks.list.mockRejectedValue(new Error('private-db-failure'));
    const html = renderToStaticMarkup(await ExternalReportHistoryPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('생성 기록을 불러오지 못했습니다.');
    expect(html).not.toContain('아직 저장된');
    expect(html).not.toContain('private-db-failure');
  });

  it('저장된 풀이와 발행일·경고를 그대로 렌더하며 인쇄 제외 클래스와 추천 제외를 유지한다', async () => {
    const html = renderToStaticMarkup(await SavedExternalReportPage({ params: Promise.resolve({ id: saved.id }) }));
    expect(mocks.get).toHaveBeenCalledWith(saved.id);
    expect(mocks.report).toHaveBeenCalledWith({ data: saved.report.data, issuedAt: saved.report.issuedAt, showRecommendations: false });
    expect(html).toContain('저장된 생성 경고');
    for (const cls of ['external-report-workspace', 'external-report-controls', 'external-report-preview']) expect(html).toContain(cls);
  });

  it('상세 조회 장애를 404로 숨기지 않고 찾을 수 없는 기록만 404로 처리한다', async () => {
    mocks.get.mockRejectedValueOnce(new Error('private-db-failure'));
    const html = renderToStaticMarkup(await SavedExternalReportPage({ params: Promise.resolve({ id: saved.id }) }));
    expect(html).toContain('저장된 보고서를 불러오지 못했습니다.');
    expect(html).not.toContain('private-db-failure');
    mocks.get.mockResolvedValueOnce(null);
    await expect(SavedExternalReportPage({ params: Promise.resolve({ id: 'invalid' }) })).rejects.toThrow('not-found');
  });

  it('글꼴 준비를 기다린 뒤 한 번만 인쇄하고 파일명을 정리한 후 원래 제목을 복구한다', async () => {
    let finishFonts!: () => void;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((resolve) => { finishFonts = resolve; }) } });
    document.title = '관리자 기록';
    let printedTitle = '';
    const print = vi.spyOn(window, 'print').mockImplementation(() => { printedTitle = document.title; });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(<HistoryPrintButton subjectName={'홍/길:동'} />));
    await act(async () => { host!.querySelector('button')!.click(); host!.querySelector('button')!.click(); });
    expect(print).not.toHaveBeenCalled();
    expect(host.querySelector('button')!.disabled).toBe(true);
    await act(async () => finishFonts());
    expect(print).toHaveBeenCalledTimes(1);
    expect(printedTitle).toBe('간지사주_깊은사주풀이_홍길동');
    expect(document.title).toBe('관리자 기록');
    expect(host.querySelector('button')!.disabled).toBe(false);
  });

  it('대기 중 다른 페이지로 이동하면 늦은 인쇄를 실행하지 않는다', async () => {
    let finishFonts!: () => void;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((resolve) => { finishFonts = resolve; }) } });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(<HistoryPrintButton subjectName="테스트고객" />));
    await act(async () => host!.querySelector('button')!.click());
    await act(async () => root!.unmount());
    root = undefined;
    document.title = '다른 페이지';
    await act(async () => finishFonts());
    expect(print).not.toHaveBeenCalled();
    expect(document.title).toBe('다른 페이지');
  });
});
