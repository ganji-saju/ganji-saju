// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/payments/nicepay-checkout', () => ({
  requestNicepayPayment: vi.fn(async () => undefined),
  toNicepayMethod: (code: string) => (code === 'KAKAOPAY' ? 'kakaopay' : 'card'),
}));

import { requestNicepayPayment } from '@/lib/payments/nicepay-checkout';
import { OrderForm } from './order-form';

const prices = {
  lifetime: { price: 29900, compareAt: 60000 },
  'new-year': { price: 19900, compareAt: 40000 },
};

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

async function mount(bankEnabled: boolean) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<OrderForm prices={prices} bankEnabled={bankEnabled} />));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.mocked(requestNicepayPayment).mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function set(id: string, value: string) {
  await act(async () => {
    const field = host.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#report-order-${id}`)!;
    const proto = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(selector: string) {
  await act(async () => host.querySelector<HTMLElement>(selector)!.click());
}
async function submit() {
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
async function fillAll() {
  await click('#report-order-product-lifetime');
  await set('name', '김민지');
  await click('#report-order-gender-female');
  await set('year', '1968');
  await set('month', '5');
  await set('day', '17');
  await set('hour', 'chuk');
  await set('phone', '010-1234-5678');
  await set('email', 'a@b.co');
  await click('#report-order-consent-privacy');
  await click('#report-order-consent-terms');
}

describe('랜딩 주문서', () => {
  it('빈 칸이 있으면 요청하지 않고 무엇이 빠졌는지 알려 준다', async () => {
    await mount(true);
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain('상품을 선택해 주세요.');
  });

  it('무통장 계좌가 설정되지 않았으면 무통장 선택지가 없다', async () => {
    await mount(false);
    expect(host.querySelector('#report-order-pay-bank')).toBeNull();
    expect(host.querySelector('#report-order-pay-CARD')).not.toBeNull();
  });

  it('카드: 주문 API 가 돌려준 금액으로 결제창을 연다', async () => {
    await mount(true);
    await fillAll();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, payMethod: 'card', orderId: 'ord_1', amount: 29900, goodsName: '종합사주 1인' })));
    await submit();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ product: 'lifetime', payMethod: 'card', name: '김민지', hourSlot: 'chuk', consentPrivacy: true, consentTerms: true });
    expect(body.amount).toBeUndefined();
    expect(body).toHaveProperty('analyticsConsent');
    expect(requestNicepayPayment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'ord_1', amount: 29900, goodsName: '종합사주 1인', method: 'card' }));
  });

  it('무통장: 신청 뒤 입금 계좌·금액·입금자명을 보여 준다', async () => {
    await mount(true);
    await fillAll();
    await click('#report-order-pay-bank');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true, payMethod: 'bank', orderNo: 'GS-R-261021-ABCD', amount: 29900,
      bank: '국민은행', account: '123-45-6789', holder: '푸꼬컴퍼니', depositDueAt: '2026-10-24T00:00:00.000Z',
    })));
    await submit();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).payMethod).toBe('bank');
    expect(requestNicepayPayment).not.toHaveBeenCalled();
    expect(host.textContent).toContain('국민은행 123-45-6789');
    expect(host.textContent).toContain('29,900원');
    expect(host.textContent).toContain('입금자명: 김민지');
    expect(host.textContent).toContain('GS-R-261021-ABCD');
  });

  it('서버 안내 문구를 그대로 보여 준다', async () => {
    await mount(true);
    await fillAll();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: '휴대폰 번호를 확인해 주세요.' }), { status: 400 }));
    await submit();
    expect(host.textContent).toContain('휴대폰 번호를 확인해 주세요.');
  });

  it('음력을 고르면 윤달 표시가 나오고 요청에 실린다', async () => {
    await mount(true);
    expect(host.querySelector('#report-order-leap')).toBeNull();
    await fillAll();
    await click('#report-order-calendar-lunar');
    await click('#report-order-leap');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'x' }), { status: 400 }));
    await submit();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ calendarType: 'lunar', lunarLeap: true });
  });

  it('주소의 #order-new-year 로 들어오면 신년운세가 골라져 있다', async () => {
    window.location.hash = '#order-new-year';
    await mount(true);
    expect(host.querySelector<HTMLInputElement>('#report-order-product-new-year')!.checked).toBe(true);
    window.location.hash = '';
  });

  it('할인코드 칸은 신년운세를 고를 때만 나오고, 간지사주50 이면 9,900원 안내 후 코드를 보낸다', async () => {
    await mount(true);
    await fillAll();
    expect(host.querySelector('#report-order-promo')).toBeNull();
    await click('#report-order-product-new-year');
    await set('promo', '간지사주50');
    expect(host.textContent).toContain('결제 시 9,900원으로 진행됩니다.');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'x' }), { status: 400 }));
    await submit();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ product: 'new-year', promoCode: '간지사주50' });
  });

  it('틀린 할인코드면 요청하지 않고 확인을 부탁한다', async () => {
    await mount(true);
    await fillAll();
    await click('#report-order-product-new-year');
    await set('promo', '아무거나');
    expect(host.textContent).toContain('사용할 수 없는 할인코드입니다.');
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain('할인코드를 확인해 주세요.');
  });

  it('신년운세에서 코드를 넣고 종합사주로 바꾸면 코드를 보내지 않는다', async () => {
    await mount(true);
    await fillAll();
    await click('#report-order-product-new-year');
    await set('promo', '간지사주50');
    await click('#report-order-product-lifetime');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'x' }), { status: 400 }));
    await submit();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).promoCode).toBeUndefined();
  });
});
