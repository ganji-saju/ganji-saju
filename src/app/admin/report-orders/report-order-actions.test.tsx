// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
import { ReportOrderActions } from './report-order-actions';

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

async function mount(props: React.ComponentProps<typeof ReportOrderActions>) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ReportOrderActions {...props} />));
}
const buttons = () => [...host.querySelectorAll('button')].map((b) => b.textContent);
async function clickText(text: string) {
  await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === text)!.click());
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 'sent' })));
  refresh.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('랜딩 주문 처리 버튼', () => {
  it('입금 대기: 입금 확인·주문 취소', async () => {
    await mount({ id: 'r1', status: 'awaiting_deposit', payMethod: 'bank' });
    expect(buttons()).toEqual(['입금 확인', '주문 취소']);
  });

  it('카드 결제 대기: 취소 대신 결제 확인만', async () => {
    await mount({ id: 'r1', status: 'pending_payment', payMethod: 'card' });
    expect(buttons()).toEqual(['결제 확인']);
  });

  it('풀이 생성됨: 확인 완료·발송을 누르면 send 를 요청하고 새로고침', async () => {
    await mount({ id: 'r1', status: 'generated', payMethod: 'card', reportId: 'ext-1' });
    expect(buttons()).toContain('다시 만들기');
    await clickText('확인 완료·발송');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/report-orders/r1', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'send', note: '', reportId: 'ext-1' });
    expect(refresh).toHaveBeenCalled();
  });

  it('발송 완료: 다시 보내기 + 환불', async () => {
    await mount({ id: 'r1', status: 'sent', payMethod: 'card', reportId: 'ext-1' });
    expect(buttons()).toEqual(['다시 보내기', '결제 취소(환불)']);
  });

  it('카드 환불은 사유를 적어야 요청한다', async () => {
    await mount({ id: 'r1', status: 'sent', payMethod: 'card' });
    await clickText('결제 취소(환불)');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain('환불 사유를 적어 주세요.');
  });

  it('서버 오류 문구를 보여 준다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: '문자와 이메일 모두 보내지 못했습니다.' }), { status: 502 }));
    await mount({ id: 'r1', status: 'generated', payMethod: 'bank', reportId: 'ext-1' });
    await clickText('확인 완료·발송');
    expect(host.textContent).toContain('문자와 이메일 모두 보내지 못했습니다.');
  });
});
