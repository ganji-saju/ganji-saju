// 2026-08-26 회귀 가드 — MP purchase/refund 페이로드.
//   문서(설계)가 "가장 흔한 실패" 로 지목한 항목들을 그대로 단언한다.
import assert from 'node:assert/strict';
import { buildPurchaseEvent, buildRefundEvent } from './ga-server';

declare const test: (name: string, fn: () => void) => void;

const BASE = {
  clientId: '123.456',
  sessionId: '1756180000',
  userId: 'u-1',
  transactionId: 'ord_abc',
  value: 9900,
  paymentMethod: 'card',
  productType: 'bundle_comprehensive',
  isFirstPurchase: true,
  items: [
    {
      itemId: 'bundle_comprehensive',
      itemName: '종합 리포트',
      itemCategory: 'bundle',
      price: 9900,
      quantity: 1,
    },
  ],
};

test('purchase: session_id 와 engagement_time_msec 은 선택이 아니라 필수', () => {
  const e = buildPurchaseEvent(BASE);
  assert.equal(e.params.session_id, '1756180000', '없으면 GA4 가 새 세션/(direct) 로 처리한다');
  assert.equal(e.params.engagement_time_msec, '1', '없으면 세션이 집계되지 않는다');
});

test('purchase: transaction_id 는 order_id — 매출 대사와 중복 제거의 유일한 키', () => {
  assert.equal(buildPurchaseEvent(BASE).params.transaction_id, 'ord_abc');
});

test('purchase: value 는 Σ(price × quantity) 와 일치해야 한다', () => {
  const e = buildPurchaseEvent(BASE);
  const items = e.params.items as Array<{ price: number; quantity: number }>;
  const sum = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  assert.equal(e.params.value, sum);
});

test('purchase: item_category 가 item_id 와 달라야 계열별 분해가 된다 · quantity 필수', () => {
  const items = buildPurchaseEvent(BASE).params.items as Array<Record<string, unknown>>;
  assert.equal(items[0].item_category, 'bundle');
  assert.notEqual(items[0].item_category, items[0].item_id);
  assert.equal(items[0].quantity, 1, '없으면 항목 보고서의 판매 수량이 빈다');
});

test('purchase: session_id 가 없으면 키 자체를 넣지 않는다 — 빈 문자열 금지', () => {
  const e = buildPurchaseEvent({ ...BASE, sessionId: null });
  assert.ok(!('session_id' in e.params));
  assert.equal(e.params.engagement_time_msec, '1');
});

test('purchase: 개인정보는 페이로드에 없다 — 생년월일·이름·이메일 금지', () => {
  const json = JSON.stringify(buildPurchaseEvent(BASE));
  for (const forbidden of ['birth', 'name":"19', 'email', '@']) {
    assert.ok(!json.includes(forbidden), `${forbidden} 이 페이로드에 있다`);
  }
});

test('refund: 원거래와 같은 transaction_id 여야 매출이 차감된다', () => {
  const e = buildRefundEvent({
    clientId: '1.2',
    sessionId: '1756180000',
    userId: null,
    transactionId: 'ord_abc',
    value: 3300,
  });
  assert.equal(e.name, 'refund');
  assert.equal(e.params.transaction_id, 'ord_abc');
  assert.equal(e.params.value, 3300, '부분 환불이면 환불 금액만');
  assert.equal(e.params.currency, 'KRW');
});
