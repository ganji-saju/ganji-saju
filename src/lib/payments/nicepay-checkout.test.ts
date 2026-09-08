// 2026-09-08 — 나이스페이 결제창 method 문자열 고정.
//
// 왜: 이 값이 'card' 로 되돌아가면 **결제는 멀쩡히 동작하면서 간편결제만 조용히 사라진다**.
//   결제창도 뜨고 승인도 되니 에러가 한 줄도 안 남는다. 나이스페이 매뉴얼
//   (payment-window-client.md) 원문: "card : 신용카드 / cardAndEasyPay : 신용카드와 간편결제 노출".
//   네이버페이·카카오페이를 카드와 한 창에 띄우려면 cardAndEasyPay 여야 한다.
import assert from 'node:assert/strict';
import { toNicepayMethod } from './nicepay-checkout';

declare const test: (name: string, fn: () => void) => void;

test('CARD 는 간편결제까지 노출하는 cardAndEasyPay 로 매핑된다', () => {
  assert.equal(toNicepayMethod('CARD'), 'cardAndEasyPay');
});

test('TRANSFER 는 실시간 계좌이체(bank)', () => {
  assert.equal(toNicepayMethod('TRANSFER'), 'bank');
});
