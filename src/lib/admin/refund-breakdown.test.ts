// 2026-08-26 회귀 가드 — "오늘 결제 990인데 환불 9,900" 제보의 해설 데이터.
//   숫자를 바꾸는 게 아니라, 그 환불의 원 결제일이 언제인지 화면이 말하게 하는 계산.
import assert from 'node:assert/strict';
import { computeRefundBreakdown } from './refund-breakdown';

declare const test: (name: string, fn: () => void) => void;

const WINDOW = { fromKey: '2026-08-01', toKey: '2026-08-26' };

/** KST 날짜의 정오 ISO — 날짜키 경계 착시 없이 그 날에 떨어진다. */
function kst(dateKey: string) {
  return new Date(Date.parse(`${dateKey}T12:00:00+09:00`)).toISOString();
}

test('환불 내역: 원 결제일이 기간 안이면 왜곡 금액에 안 들어간다', () => {
  const out = computeRefundBreakdown(
    [
      {
        order_id: 'o1',
        package_id: 'bundle_comprehensive',
        amount: 9900,
        refunded_at: kst('2026-08-26'),
        confirmed_at: kst('2026-08-20'),
        fulfilled_at: null,
        created_at: kst('2026-08-20'),
      },
    ],
    WINDOW
  );

  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].amountWon, 9900);
  assert.equal(out.items[0].paidOn, '2026-08-20');
  assert.equal(out.items[0].paidInWindow, true);
  assert.equal(out.items[0].sameDay, false);
  assert.equal(out.totalWon, 9900);
  assert.equal(out.outsideWindowWon, 0, '기간 안에서 팔고 기간 안에서 환불 → 합계는 상쇄된다');
});

test('환불 내역: 기간 밖 결제의 환불은 기간 순매출을 그대로 깎는다', () => {
  const out = computeRefundBreakdown(
    [
      {
        order_id: 'o2',
        package_id: 'bundle_comprehensive',
        amount: 9900,
        refunded_at: kst('2026-08-26'),
        confirmed_at: kst('2026-07-10'),
        fulfilled_at: null,
        created_at: kst('2026-07-10'),
      },
    ],
    WINDOW
  );

  assert.equal(out.items[0].paidInWindow, false);
  assert.equal(out.outsideWindowWon, 9900);
});

test('환불 내역: 원 결제일을 모르면 기간 안이라고 단정하지 않는다', () => {
  const out = computeRefundBreakdown(
    [
      {
        order_id: 'o3',
        package_id: 'taste_dialogue_entry',
        amount: 990,
        refunded_at: kst('2026-08-26'),
        confirmed_at: null,
        fulfilled_at: null,
        created_at: null,
      },
    ],
    WINDOW
  );

  assert.equal(out.items[0].paidOn, null);
  assert.equal(out.items[0].paidInWindow, false);
  assert.equal(out.outsideWindowWon, 990, '모르는 건을 정상으로 분류하면 왜곡액이 과소 집계된다');
});

test('환불 내역: 기간 밖 환불 행은 제외 · 최신 환불일 먼저', () => {
  const out = computeRefundBreakdown(
    [
      {
        order_id: 'old',
        package_id: 'bundle_comprehensive',
        amount: 9900,
        refunded_at: kst('2026-07-31'),
        confirmed_at: kst('2026-07-30'),
        fulfilled_at: null,
        created_at: kst('2026-07-30'),
      },
      {
        order_id: 'a',
        package_id: 'taste_dialogue_entry',
        amount: 990,
        refunded_at: kst('2026-08-10'),
        confirmed_at: kst('2026-08-10'),
        fulfilled_at: null,
        created_at: kst('2026-08-10'),
      },
      {
        order_id: 'b',
        package_id: 'taste_tarot_daily',
        amount: 990,
        refunded_at: kst('2026-08-25'),
        confirmed_at: kst('2026-08-25'),
        fulfilled_at: null,
        created_at: kst('2026-08-25'),
      },
    ],
    WINDOW
  );

  assert.deepEqual(
    out.items.map((i) => i.orderId),
    ['b', 'a']
  );
  assert.equal(out.totalWon, 1980);
  assert.equal(out.items[0].sameDay, true, '당일 결제·당일 환불은 마이너스로 보일 일이 없다');
});

test('환불 내역: 상품명은 카탈로그에서, 없으면 packageId 그대로', () => {
  const out = computeRefundBreakdown(
    [
      {
        order_id: 'o4',
        package_id: 'taste_dialogue_entry',
        amount: 990,
        refunded_at: kst('2026-08-26'),
        confirmed_at: kst('2026-08-26'),
        fulfilled_at: null,
        created_at: kst('2026-08-26'),
      },
      {
        order_id: 'o5',
        package_id: 'credit_legacy_gone',
        amount: 3300,
        refunded_at: kst('2026-08-26'),
        confirmed_at: kst('2026-08-26'),
        fulfilled_at: null,
        created_at: kst('2026-08-26'),
      },
    ],
    WINDOW
  );

  assert.equal(out.items[0].productName, '대화상담 질문 3회');
  assert.equal(out.items[1].productName, 'credit_legacy_gone');
});
