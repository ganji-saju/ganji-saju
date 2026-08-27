// 2026-08-26 회귀 가드 — 990원 '대화상담 질문 3회'가 관리자 환불 목록에서 사라지던 버그.
//   이 상품은 전달물이 이용권이 아니라 전 3개라 product_entitlements 행이 없고,
//   여기서마저 '전팩이 아니다'로 잘리면 결제·번들·전 3경로 어디에도 안 잡힌다.
import assert from 'node:assert/strict';
import { buildCreditRefundItem, type CreditRefundLotRow } from './credit-refunds';

declare const test: (name: string, fn: () => void) => void;

const NOW = new Date('2026-08-26T00:00:00.000Z');
const LATER = '2027-08-26T00:00:00.000Z';

function lot(overrides: Partial<CreditRefundLotRow> = {}): CreditRefundLotRow {
  return {
    id: 'lot-1',
    amount_remaining: 3,
    amount_initial: 3,
    expires_at: LATER,
    source: 'purchase',
    metadata: { paymentKey: 'pay_1' },
    created_at: NOW.toISOString(),
    ...overrides,
  };
}

test('대화상담 질문 3회(taste_product 990원) 결제도 환불 후보로 잡힌다', () => {
  const item = buildCreditRefundItem(
    {
      id: 'tx-1',
      type: 'purchase',
      amount: 3,
      metadata: {
        paymentKey: 'pay_1',
        packageId: 'taste_dialogue_entry',
        orderId: 'order-1',
        amount: 990,
      },
      created_at: NOW.toISOString(),
    },
    [lot()],
    NOW
  );

  assert.ok(item, '전팩이 아니라는 이유로 null 이 되면 안 된다');
  // ⚠️ 2026-08-27 — 상품명 문자열을 박지 않는다. 카탈로그는 브랜치마다 다르고(개편 전용
  //   상품이 있다), 이름을 박으면 이 테스트가 관리자 코드 이관을 막는다. 여기서 지켜야 할
  //   계약은 "전팩이 아니어도 환불 후보로 잡힌다"이지 특정 상품의 이름이 아니다.
  assert.ok(item.productName.length > 0);
  assert.notEqual(item.productName, '전 충전', '전 충전 기본값으로 떨어지면 안 된다');
  assert.equal(item.originalAmountWon, 990);
  assert.equal(item.refundAmountWon, 990);
  assert.equal(item.status, 'full');
});

test('일부 사용분은 사용량에 비례해 부분 환불', () => {
  const item = buildCreditRefundItem(
    {
      id: 'tx-2',
      type: 'purchase',
      amount: 3,
      metadata: { paymentKey: 'pay_2', packageId: 'taste_dialogue_entry', amount: 990 },
      created_at: NOW.toISOString(),
    },
    [lot({ id: 'lot-2', amount_remaining: 1, metadata: { paymentKey: 'pay_2' } })],
    NOW
  );

  assert.ok(item);
  assert.equal(item.status, 'partial');
  assert.equal(item.coinsUsed, 2);
  assert.equal(item.refundAmountWon, 330);
});

test('멤버십 적립(type=subscription)은 여전히 환불 후보가 아니다 — 중복 계상 방지', () => {
  const item = buildCreditRefundItem(
    {
      id: 'tx-3',
      type: 'subscription',
      amount: 90,
      metadata: { paymentKey: 'pay_3', packageId: 'membership_premium', amount: 49000 },
      created_at: NOW.toISOString(),
    },
    [lot({ id: 'lot-3', source: 'subscription', metadata: { paymentKey: 'pay_3' } })],
    NOW
  );

  assert.equal(item, null);
});

test('paymentKey 없는 지급(어드민 수동 등)은 환불 후보가 아니다', () => {
  const item = buildCreditRefundItem(
    {
      id: 'tx-4',
      type: 'purchase',
      amount: 3,
      metadata: { packageId: 'taste_dialogue_entry' },
      created_at: NOW.toISOString(),
    },
    [],
    NOW
  );

  assert.equal(item, null);
});

test('구 전팩(credit_ 접두사, 카탈로그 폐지분)도 계속 잡힌다', () => {
  const item = buildCreditRefundItem(
    {
      id: 'tx-5',
      type: 'purchase',
      amount: 3,
      metadata: { paymentKey: 'pay_5', packageId: 'credit_3', amount: 3300 },
      created_at: NOW.toISOString(),
    },
    [lot({ id: 'lot-5', metadata: { paymentKey: 'pay_5' } })],
    NOW
  );

  assert.ok(item);
  assert.equal(item.refundAmountWon, 3300);
});
