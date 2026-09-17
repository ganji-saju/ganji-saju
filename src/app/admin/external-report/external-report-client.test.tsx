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
    data: { subjectName: '테스트고객' },
    issuedAt: '2026.09.17',
    generationSource: 'openai',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('외부 주문 PDF 입력과 미리보기', () => {
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
