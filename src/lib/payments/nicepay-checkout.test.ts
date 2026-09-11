// 2026-09-08 — 나이스페이 결제창 method 문자열 고정.
//
// 왜: 이 매핑이 어긋나도 **결제는 멀쩡히 동작한다** — 결제창도 뜨고 승인도 되니 에러가
//   한 줄도 안 남는다. 잘못된 수단이 뜨거나 수단이 조용히 사라질 뿐이다. 그래서 고정한다.
//   매핑 정본은 methods.ts 의 nicepayMethod(표 자체는 methods.test.ts 가 고정).
//
// 🔴 특히 'bank'(실시간 계좌이체)는 **어떤 입력으로도 나가면 안 된다**. 나이스페이 안내상
//   계좌이체를 넣는 순간 결제 자체가 막힌다. 픽커가 안 보여주지만 여기가 마지막 관문이다.
import assert from 'node:assert/strict';
import { toNicepayMethod } from './nicepay-checkout';

declare const test: (name: string, fn: () => void) => void;

test('간편결제 수단은 각자의 결제창으로 바로 간다', () => {
  assert.equal(toNicepayMethod('KAKAOPAY'), 'kakaopay');
  assert.equal(toNicepayMethod('NAVERPAY'), 'naverpayCard');
  assert.equal(toNicepayMethod('SAMSUNGPAY'), 'samsungpayCard');
});

test('CARD 는 카드 전용 — 간편결제를 개별 버튼으로 분리했으므로 cardAndEasyPay 가 아니다', () => {
  assert.equal(toNicepayMethod('CARD'), 'card');
});

test("어떤 입력에도 'bank'(계좌이체)로는 매핑되지 않는다 — 넣으면 결제가 막힌다", () => {
  const inputs = ['TRANSFER', 'BANK', 'bank', 'VIRTUAL_ACCOUNT', 'vbank', 'cellphone', '', 'unknown'];
  for (const input of inputs) {
    assert.notEqual(toNicepayMethod(input), 'bank', `${input} → bank 로 새면 안 된다`);
    assert.equal(toNicepayMethod(input), 'card', `${input} 은 안전한 기본값(card)으로 떨어져야 한다`);
  }
});
