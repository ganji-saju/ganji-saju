// 2026-07-10 — PG 취소 통보(웹훅) 시 회수 계획.
//
// 실제 사고: 2026-07-10 17:29 결제 승인·지급(score-total, 9,900원) → 17:31 나이스페이 취소.
//   주문은 canceled 로 바뀌었으나 product_entitlements 행이 그대로 남아 **환불 후에도 유료
//   콘텐츠가 열렸다**. 원인은 webhook/nicepay 가 `pkg.credits > 0` 일 때만 회수했기 때문.
//   score-total·today-detail·year-core·lifetime 같은 단품은 credits=0 이라 분기에 걸리지 않는다.
//
// 회수는 **지급과 대칭**이어야 한다. 지급이 order_id 로 entitlement 를 남기므로,
// 회수도 order_id 로 열거해 전부 제거한다(번들이면 구성품 전부).
import assert from 'node:assert/strict';
import {
  buildCancellationRevokePlan,
  resolveCancellationTerminalStatus,
} from './cancellation';

declare const test: (name: string, fn: () => void) => void;

const ENT_SCORE = { userId: 'user-1', productId: 'score-total', scopeKey: 'saju:abc' } as const;
const ENT_TODAY = { userId: 'user-1', productId: 'today-detail', scopeKey: 'today:abc' } as const;

test('단품(credits=0) 지급분도 회수한다 — 이번 사고의 회귀 차단', () => {
  const plan = buildCancellationRevokePlan({
    orderStatus: 'fulfilled',
    packageCredits: 0,
    entitlements: [ENT_SCORE],
  });
  assert.equal(plan.revokeCredits, 0);
  assert.deepEqual(plan.revokeEntitlements, [ENT_SCORE]);
  assert.equal(plan.hasWork, true);
});

test('번들 지급분은 구성품 전부 회수한다', () => {
  const plan = buildCancellationRevokePlan({
    orderStatus: 'fulfilled',
    packageCredits: 0,
    entitlements: [ENT_SCORE, ENT_TODAY],
  });
  assert.deepEqual(plan.revokeEntitlements, [ENT_SCORE, ENT_TODAY]);
});

test('전 패키지는 전을 회수한다(기존 동작 보존)', () => {
  const plan = buildCancellationRevokePlan({
    orderStatus: 'fulfilled',
    packageCredits: 15,
    entitlements: [],
  });
  assert.equal(plan.revokeCredits, 15);
  assert.deepEqual(plan.revokeEntitlements, []);
  assert.equal(plan.hasWork, true);
});

test('전 + 이용권을 함께 준 주문은 둘 다 회수한다', () => {
  const plan = buildCancellationRevokePlan({
    orderStatus: 'fulfilled',
    packageCredits: 15,
    entitlements: [ENT_SCORE],
  });
  assert.equal(plan.revokeCredits, 15);
  assert.deepEqual(plan.revokeEntitlements, [ENT_SCORE]);
});

test('지급되지 않은 주문(prepared/payment_failed)은 아무것도 회수하지 않는다', () => {
  for (const orderStatus of ['prepared', 'payment_failed', 'canceled'] as const) {
    const plan = buildCancellationRevokePlan({
      orderStatus,
      packageCredits: 15,
      entitlements: [ENT_SCORE],
    });
    assert.equal(plan.revokeCredits, 0, `${orderStatus} 는 전을 회수하지 않는다`);
    assert.deepEqual(plan.revokeEntitlements, [], `${orderStatus} 는 이용권을 회수하지 않는다`);
    assert.equal(plan.hasWork, false);
  }
});

test('fulfilling(지급 진행 중) 주문도 이미 남은 이용권은 회수한다', () => {
  const plan = buildCancellationRevokePlan({
    orderStatus: 'fulfilling',
    packageCredits: 0,
    entitlements: [ENT_SCORE],
  });
  assert.deepEqual(plan.revokeEntitlements, [ENT_SCORE], '부분 지급 잔재를 남기면 안 된다');
});

test('회수할 게 없으면 hasWork=false', () => {
  const plan = buildCancellationRevokePlan({
    orderStatus: 'fulfilled',
    packageCredits: 0,
    entitlements: [],
  });
  assert.equal(plan.hasWork, false);
});

// 2026-07-13 — 취소 통보 시 종료 상태 판정.
//   결제까지 간 주문을 취소하면 = 환불이다 → 'refunded'(매출 이력 보존).
//   결제 전에 창을 닫은 주문은 = 단순 취소 → 'canceled'.
//   과거엔 둘 다 'canceled' 로 뭉개져 결제 성공분이 매출에서 사라졌다.
//   '결제까지 갔다'의 신호 = confirmedAt/fulfilledAt 존재 또는 지급 상태.

test('결제 승인된 주문의 취소는 refunded (confirmedAt 존재)', () => {
  assert.equal(
    resolveCancellationTerminalStatus({ status: 'fulfilled', confirmedAt: '2026-07-13T00:00:00Z', fulfilledAt: '2026-07-13T00:00:01Z' }),
    'refunded'
  );
});

test('지급은 실패했어도 결제 승인됐으면 refunded (돈은 받았다)', () => {
  assert.equal(
    resolveCancellationTerminalStatus({ status: 'fulfillment_failed', confirmedAt: '2026-07-13T00:00:00Z', fulfilledAt: null }),
    'refunded'
  );
});

test('지급 상태(confirmed/fulfilling/fulfilled)면 timestamp 없어도 refunded', () => {
  for (const status of ['confirmed', 'fulfilling', 'fulfilled'] as const) {
    assert.equal(
      resolveCancellationTerminalStatus({ status, confirmedAt: null, fulfilledAt: null }),
      'refunded',
      status
    );
  }
});

test('결제 전 취소는 canceled (prepared·승인시각 없음)', () => {
  assert.equal(
    resolveCancellationTerminalStatus({ status: 'prepared', confirmedAt: null, fulfilledAt: null }),
    'canceled'
  );
});

test('결제 실패분의 취소통보는 canceled (돈을 받지 않았다)', () => {
  assert.equal(
    resolveCancellationTerminalStatus({ status: 'payment_failed', confirmedAt: null, fulfilledAt: null }),
    'canceled'
  );
});

// 2026-07-13 — admin 환불 경로 대칭화. 전액환불만 원주문을 refunded 로 표시한다.
//   부분환불을 전액으로 오판하면 나머지 매출까지 통째로 사라진다 → 애매하면 표시 안 함(보수).
import { isFullRefund } from './cancellation';

test('isFullRefund: 환불액 == 원결제액 → 전액', () => {
  assert.equal(isFullRefund({ amount: 9900, originalAmount: 9900 }), true);
});

test('isFullRefund: 환불액 < 원결제액 → 부분(false)', () => {
  assert.equal(isFullRefund({ amount: 5000, originalAmount: 9900 }), false);
});

test('isFullRefund: 정보 부족(어느 쪽 null)이면 보수적으로 false', () => {
  assert.equal(isFullRefund({ amount: null, originalAmount: 9900 }), false);
  assert.equal(isFullRefund({ amount: 9900, originalAmount: null }), false);
  assert.equal(isFullRefund({ amount: null, originalAmount: null }), false);
});
