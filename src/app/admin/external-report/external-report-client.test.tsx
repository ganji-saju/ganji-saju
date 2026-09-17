// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalReportClient } from './external-report-client';

vi.mock('@/components/report/report-document', () => ({
  ReportDocument: ({ data, showRecommendations }: { data: { subjectName: string }; showRecommendations: boolean }) => (
    <article data-testid="generated-report" data-recommendations={String(showRecommendations)}>
      {data.subjectName} 보고서
    </article>
  ),
}));

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ExternalReportClient />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function enter(id: string, value: string) {
  await act(async () => {
    const field = host.querySelector<HTMLInputElement | HTMLSelectElement>(`#external-report-${id}`)!;
    const prototype = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

async function fillBuyer() {
  await enter('name', '테스트고객');
  await enter('gender', 'female');
  await enter('year', '1990');
  await enter('month', '5');
  await enter('day', '15');
}

async function submit() {
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

function button(text: string) {
  return Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;
}

function success() {
  return new Response(JSON.stringify({
    ok: true,
    recordId: '6a4f0d1e-df2e-4f76-89d3-6b51590336fb',
    createdAt: '2026-09-18T03:00:00.000Z',
    data: { subjectName: '테스트고객' },
    issuedAt: '2026.09.17',
    generationSource: 'openai',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function locationSuccess() {
  return new Response(JSON.stringify({ ok: true, items: [{
    id: 'seongnam', label: '성남시', displayName: '경기도 성남시, 대한민국',
    latitude: 37.4201, longitude: 127.1265,
  }] }), { status: 200 });
}

describe('외부 주문 PDF 입력과 미리보기', () => {
  it('직접 입력 지역을 검색해 선택한 좌표를 보고서 요청에 포함하고 지역명 수정 시 좌표를 지운다', async () => {
    await fillBuyer();
    await enter('location', 'custom');
    await enter('location-label', '경기 성남');
    fetchMock.mockResolvedValueOnce(locationSuccess());
    await act(async () => button('좌표 찾기').click());
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/geo/birth-location?q=${encodeURIComponent('경기 성남')}`);
    expect(fetchMock.mock.calls[0][1].cache).toBe('force-cache');
    expect(host.querySelector<HTMLInputElement>('#external-report-latitude')!.value).toBe('');
    await act(async () => button('경기도 성남시').click());
    expect(host.querySelector<HTMLInputElement>('#external-report-latitude')!.value).toBe('37.4201');
    expect(host.querySelector<HTMLInputElement>('#external-report-longitude')!.value).toBe('127.1265');
    fetchMock.mockResolvedValueOnce(success());
    await submit();
    expect(host.querySelector('a[href="/admin/external-report/history/6a4f0d1e-df2e-4f76-89d3-6b51590336fb"]')?.textContent).toBe('저장된 보고서 열기');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      birthLocationCode: 'custom', birthLocationLabel: '성남시', birthLatitude: '37.4201', birthLongitude: '127.1265',
    });
    await enter('location-label', '수원');
    expect(host.querySelector<HTMLInputElement>('#external-report-latitude')!.value).toBe('');
    expect(host.querySelector<HTMLInputElement>('#external-report-longitude')!.value).toBe('');
    expect(host.querySelector('[data-testid="generated-report"]')).toBeNull();
  });

  it.each(['지역명 수정', '프리셋 선택', '초기화'])('%s 시 진행 중인 좌표 조회를 취소하고 늦은 응답을 무시한다', async (change) => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
    await enter('location', 'custom');
    await enter('location-label', '성남');
    await act(async () => button('좌표 찾기').click());
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    if (change === '지역명 수정') await enter('location-label', '수원');
    else if (change === '프리셋 선택') await enter('location', 'seoul');
    else await act(async () => button('입력 초기화').click());
    expect(signal.aborted).toBe(true);
    await act(async () => finish(locationSuccess()));
    expect(button('경기도 성남시')).toBeUndefined();
    expect(host.textContent).not.toContain('검색 결과에서 출생지를 선택하면');
    if (change === '지역명 수정') {
      expect(host.querySelector<HTMLInputElement>('#external-report-latitude')!.value).toBe('');
    }
  });

  it('좌표 조회 입력 오류와 서비스 오류를 알리고 재시도를 허용한다', async () => {
    await enter('location', 'custom');
    await enter('location-label', '성');
    await act(async () => button('좌표 찾기').click());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain('두 글자 이상');
    await enter('location-label', '성남');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: '검색 서비스 오류' }), { status: 502 }));
    await act(async () => button('좌표 찾기').click());
    expect(host.textContent).toContain('검색 서비스 오류');
    expect(button('좌표 찾기').disabled).toBe(false);
    fetchMock.mockResolvedValueOnce(locationSuccess());
    await act(async () => button('좌표 찾기').click());
    expect(button('경기도 성남시')).toBeDefined();
  });

  it('구매자 입력을 POST 본문에만 보내고 추천 상품 없는 보고서를 출력한다', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    fetchMock.mockResolvedValueOnce(success());
    await fillBuyer();
    await submit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/external-report');
    expect(options.method).toBe('POST');
    expect(options.cache).toBe('no-store');
    expect(JSON.parse(options.body)).toMatchObject({
      name: '테스트고객', year: '1990', month: '5', day: '15', gender: 'female', unknownBirthTime: true,
    });
    expect(storageWrite).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="generated-report"]')?.getAttribute('data-recommendations')).toBe('false');

    document.title = '관리자';
    let printedTitle = '';
    vi.spyOn(window, 'print').mockImplementation(() => { printedTitle = document.title; });
    await act(async () => button('PDF로 저장').click());
    expect(printedTitle).toBe('간지사주_깊은사주풀이_테스트고객');
    expect(document.title).toBe('관리자');
  });

  it('글꼴 대기 중 저장 기록 화면으로 이동하면 인쇄와 이전 제목 복원을 건너뛴다', async () => {
    fetchMock.mockResolvedValueOnce(success());
    await fillBuyer();
    await submit();
    let ready!: () => void;
    const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((resolve) => { ready = resolve; }) } });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    try {
      document.title = '생성 화면';
      await act(async () => button('PDF로 저장').click());
      await act(async () => root.render(null));
      document.title = 'PDF 생성 기록';
      await act(async () => ready());
      expect(print).not.toHaveBeenCalled();
      expect(document.title).toBe('PDF 생성 기록');
    } finally {
      if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
      else Reflect.deleteProperty(document, 'fonts');
    }
  });

  it('입력이 바뀌면 이전 구매자 보고서를 즉시 제거하고 초기화하면 모든 입력을 지운다', async () => {
    fetchMock.mockResolvedValueOnce(success());
    await fillBuyer();
    await submit();
    expect(host.querySelector('[data-testid="generated-report"]')).not.toBeNull();
    await enter('name', '다음고객');
    expect(host.querySelector('[data-testid="generated-report"]')).toBeNull();
    expect(button('PDF로 저장')).toBeUndefined();

    await act(async () => button('입력 초기화').click());
    for (const id of ['name', 'year', 'month', 'day', 'gender']) {
      expect(host.querySelector<HTMLInputElement>(`#external-report-${id}`)!.value).toBe('');
    }
  });

  it('생성 중 초기화하면 진행 요청을 취소하고 늦은 응답을 폐기한다', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
    await fillBuyer();
    await submit();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    await act(async () => button('입력 초기화').click());
    expect(signal.aborted).toBe(true);
    await act(async () => finish(success()));
    expect(host.querySelector('[data-testid="generated-report"]')).toBeNull();
    expect(host.querySelector<HTMLInputElement>('#external-report-name')!.value).toBe('');
  });

  it('잘못된 날짜는 생성 요청 전에 설명하고 서버 오류 후 재시도할 수 있다', async () => {
    await fillBuyer();
    await enter('month', '2');
    await enter('day', '31');
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();

    await enter('day', '15');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: '접근 권한이 없습니다.' }), { status: 403 }));
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('접근 권한이 없습니다.');
    expect(button('보고서 생성').disabled).toBe(false);
  });
});
