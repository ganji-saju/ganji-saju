// 2026-09-08 — 나이스페이 결제창 method 문자열 고정.
//
// 왜 ①: 'card' 로 되돌아가면 **결제는 멀쩡히 동작하면서 간편결제만 조용히 사라진다**.
//   결제창도 뜨고 승인도 되니 에러가 한 줄도 안 남는다. 나이스페이 매뉴얼
//   (payment-window-client.md) 원문: "card : 신용카드 / cardAndEasyPay : 신용카드와 간편결제 노출".
//
// 왜 ②: 반대로 'bank'(실시간 계좌이체)는 **절대 나가면 안 된다**. 나이스페이 안내상
//   계좌이체를 넣으면 결제 자체가 막힌다. 여긴 그게 새는 마지막 관문이다.
import assert from 'node:assert/strict';
import { toNicepayMethod } from './nicepay-checkout';

declare const test: (name: string, fn: () => void) => void;

test('CARD 는 간편결제까지 노출하는 cardAndEasyPay 로 매핑된다', () => {
  assert.equal(toNicepayMethod('CARD'), 'cardAndEasyPay');
});

test("어떤 입력에도 'bank'(계좌이체)로는 매핑되지 않는다 — 넣으면 결제가 막힌다", () => {
  for (const input of ['TRANSFER', 'BANK', 'bank', 'VIRTUAL_ACCOUNT', '', 'unknown']) {
    assert.notEqual(toNicepayMethod(input), 'bank', `${input} → bank 로 새면 안 된다`);
    assert.equal(toNicepayMethod(input), 'cardAndEasyPay');
  }
});
