import assert from 'node:assert/strict';
import {
  buildPaymentHistory,
  isCashCreditTransaction,
  mapCreditTransactionToHistory,
  mapProductEntitlementToHistory,
  resolveProductEntitlementName,
  type CreditTransactionHistoryRow,
  type ProductEntitlementHistoryRow,
} from './payment-history';
import { getPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void) => void;

test('resolveProductEntitlementName maps known product ids to catalog names', () => {
  // taste product → catalog package name
  assert.equal(resolveProductEntitlementName('today-detail'), '오늘 자세히 보기');
  assert.equal(resolveProductEntitlementName('year-core'), '올해 핵심 3줄');
  assert.equal(resolveProductEntitlementName('score-factor'), '점수 풀이 보기');
  // lifetime-report → lifetime_report package name (not a TasteProductId)
  assert.equal(resolveProductEntitlementName('lifetime-report'), '보관형 사주 리포트');
  // unknown product id → raw id (human-review fallback)
  assert.equal(resolveProductEntitlementName('mystery-product'), 'mystery-product');
});

test('mapProductEntitlementToHistory derives category, name, WON, receipt', () => {
  const tasteRow: ProductEntitlementHistoryRow = {
    id: 'pe-1',
    product_id: 'today-detail',
    amount: 550,
    order_id: 'ORD-TASTE-0001',
    payment_key: 'pay_abc',
    package_id: 'taste_today_detail',
    created_at: '2026-05-20T01:00:00.000Z',
    metadata: null,
  };
  const taste = mapProductEntitlementToHistory(tasteRow);
  assert.equal(taste.category, '단건 풀이');
  assert.equal(taste.productName, '오늘 자세히 보기');
  assert.equal(taste.amountWon, 550);
  assert.equal(taste.coins, null);
  assert.equal(taste.receipt, 'ORD-TASTE-0001'); // order_id preferred over payment_key
  assert.equal(taste.source, 'product_entitlements');

  const lifetimeRow: ProductEntitlementHistoryRow = {
    id: 'pe-2',
    product_id: 'lifetime-report',
    amount: 49000,
    order_id: null,
    payment_key: 'pay_life',
    package_id: 'lifetime_report',
    created_at: '2026-05-21T01:00:00.000Z',
    metadata: null,
  };
  const lifetime = mapProductEntitlementToHistory(lifetimeRow);
  assert.equal(lifetime.category, '평생 리포트');
  assert.equal(lifetime.productName, '보관형 사주 리포트');
  assert.equal(lifetime.amountWon, 49000);
  assert.equal(lifetime.receipt, 'pay_life'); // falls back to payment_key when no order_id
});

test('mapProductEntitlementToHistory falls back to metadata.amount then package price', () => {
  // amount null → metadata.amount
  const metaAmount = mapProductEntitlementToHistory({
    id: 'pe-3',
    product_id: 'love-question',
    amount: null,
    order_id: 'O3',
    payment_key: null,
    package_id: null,
    created_at: '2026-05-19T00:00:00.000Z',
    metadata: { amount: 990 },
  });
  assert.equal(metaAmount.amountWon, 990);

  // amount null + no metadata.amount → catalog price via package_id
  const pkgFallback = mapProductEntitlementToHistory({
    id: 'pe-4',
    product_id: 'year-core',
    amount: null,
    order_id: 'O4',
    payment_key: null,
    package_id: 'taste_year_core',
    created_at: '2026-05-19T00:00:00.000Z',
    metadata: null,
  });
  // 2026-07-18 — 카탈로그 기준으로 단언. 검증 대상은 "package_id 로 카탈로그 가격을 찾는가"
  //   이지 특정 금액이 아니라, 가격 이벤트로 무관하게 깨지지 않게 한다.
  assert.equal(pkgFallback.amountWon, getPackage('taste_year_core')?.price);

  // nothing resolvable → null (excluded from total)
  const unresolved = mapProductEntitlementToHistory({
    id: 'pe-5',
    product_id: 'today-detail',
    amount: null,
    order_id: 'O5',
    payment_key: null,
    package_id: null,
    created_at: '2026-05-19T00:00:00.000Z',
    metadata: null,
  });
  // today-detail has a catalog package via product id resolution but amount comes from
  // package_id only; package_id null → amountWon null.
  assert.equal(unresolved.amountWon, null);
});

test('mapCreditTransactionToHistory derives WON from package price, category from type', () => {
  // coin pack purchase — WON from catalog package price
  const coinPack: CreditTransactionHistoryRow = {
    id: 'ct-1',
    type: 'purchase',
    amount: 15,
    metadata: { packageId: 'credit_15', orderId: 'ORD-COIN-7', paymentKey: 'pay_coin' },
    created_at: '2026-05-18T00:00:00.000Z',
  };
  const coin = mapCreditTransactionToHistory(coinPack);
  assert.equal(coin.category, '전 충전');
  assert.equal(coin.productName, '15 전 (50% 보너스)');
  assert.equal(coin.amountWon, 9900);
  assert.equal(coin.coins, 15);
  assert.equal(coin.receipt, 'ORD-COIN-7');

  // membership subscription — WON from package price, category 멤버십/구독
  const membership: CreditTransactionHistoryRow = {
    id: 'ct-2',
    type: 'subscription',
    amount: 90,
    metadata: { packageId: 'membership_premium', orderId: 'ORD-MEM' },
    created_at: '2026-05-17T00:00:00.000Z',
  };
  const mem = mapCreditTransactionToHistory(membership);
  assert.equal(mem.category, '멤버십/구독');
  assert.equal(mem.productName, '프리미엄 대화 멤버십');
  assert.equal(mem.amountWon, 49000);
  assert.equal(mem.coins, 90);
});

test('mapCreditTransactionToHistory falls back when packageId missing', () => {
  const noPkg: CreditTransactionHistoryRow = {
    id: 'ct-3',
    type: 'purchase',
    amount: 3,
    metadata: { amount: 990, paymentKey: 'pay_only' },
    created_at: '2026-05-16T00:00:00.000Z',
  };
  const entry = mapCreditTransactionToHistory(noPkg);
  assert.equal(entry.productName, '전 충전'); // generic label
  assert.equal(entry.amountWon, 990); // metadata.amount
  assert.equal(entry.receipt, 'pay_only'); // paymentKey when no orderId
});

test('isCashCreditTransaction excludes legacy audit and revoke rows', () => {
  assert.equal(isCashCreditTransaction({ type: 'purchase', feature: null }), true);
  assert.equal(isCashCreditTransaction({ type: 'subscription', feature: null }), true);
  // legacy taste_product audit (amount=0, duplicates product_entitlements)
  assert.equal(isCashCreditTransaction({ type: 'purchase', feature: 'taste_product' }), false);
  // entitlement revoke audit
  assert.equal(isCashCreditTransaction({ type: 'purchase', feature: 'entitlement_revoke' }), false);
  // coin refund audit
  assert.equal(isCashCreditTransaction({ type: 'purchase', feature: 'credit_refund' }), false);
  // coin spend is not a cash payment
  assert.equal(isCashCreditTransaction({ type: 'use', feature: 'ai_chat' }), false);
});

test('buildPaymentHistory combines sources, sorts date-desc, sums WON', () => {
  const result = buildPaymentHistory({
    productEntitlements: [
      {
        id: 'pe-a',
        product_id: 'today-detail',
        amount: 550,
        order_id: 'OA',
        payment_key: null,
        package_id: 'taste_today_detail',
        created_at: '2026-05-20T00:00:00.000Z',
        metadata: null,
      },
      {
        id: 'pe-b',
        product_id: 'lifetime-report',
        amount: 49000,
        order_id: 'OB',
        payment_key: null,
        package_id: 'lifetime_report',
        created_at: '2026-05-10T00:00:00.000Z',
        metadata: null,
      },
    ],
    creditTransactions: [
      {
        id: 'ct-a',
        type: 'purchase',
        amount: 15,
        metadata: { packageId: 'credit_15', orderId: 'OC' },
        created_at: '2026-05-22T00:00:00.000Z',
      },
    ],
  });

  // sorted newest → oldest by date
  assert.deepEqual(
    result.entries.map((e) => e.id),
    ['ct-a', 'pe-a', 'pe-b']
  );
  assert.equal(result.count, 3);
  // total = 9900 (coin_15) + 550 (today-detail) + 49000 (lifetime) = 59450
  assert.equal(result.totalSpentWon, 59450);
});

test('buildPaymentHistory skips null amounts in total but keeps the entry', () => {
  const result = buildPaymentHistory({
    productEntitlements: [
      {
        id: 'pe-null',
        product_id: 'today-detail',
        amount: null,
        order_id: 'ON',
        payment_key: null,
        package_id: null,
        created_at: '2026-05-20T00:00:00.000Z',
        metadata: null,
      },
    ],
    creditTransactions: [
      {
        id: 'ct-x',
        type: 'purchase',
        amount: 15,
        metadata: { packageId: 'credit_15' },
        created_at: '2026-05-21T00:00:00.000Z',
      },
    ],
  });
  assert.equal(result.count, 2); // both kept
  assert.equal(result.totalSpentWon, 9900); // only credit_15 (9900) counted; null skipped
});

// ── 2026-07-04 admin 지표 감사 — payment_orders 소스 병합 + 관련 회귀 가드 ──

test('buildPaymentHistory merges payment_orders but dedupes by orderId', () => {
  const result = buildPaymentHistory({
    productEntitlements: [
      {
        id: 'pe-1',
        product_id: 'today-detail',
        amount: 9900,
        order_id: 'ORD-DUP-ENT',
        payment_key: null,
        package_id: 'taste_today_detail',
        created_at: '2026-07-01T00:00:00.000Z',
        metadata: null,
      },
    ],
    creditTransactions: [
      {
        id: 'ct-1',
        type: 'purchase',
        amount: 15,
        metadata: { packageId: 'credit_15', orderId: 'ORD-DUP-CT' },
        created_at: '2026-07-02T00:00:00.000Z',
      },
    ],
    paymentOrders: [
      // 기존 소스와 겹치는 주문 2건 — 제외돼야 함(레거시 이중기록 방지).
      {
        id: 'po-dup-1',
        order_id: 'ORD-DUP-ENT',
        package_id: 'taste_today_detail',
        amount: 9900,
        status: 'fulfilled',
        created_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'po-dup-2',
        order_id: 'ORD-DUP-CT',
        package_id: 'credit_15',
        amount: 9900,
        status: 'fulfilled',
        created_at: '2026-07-02T00:00:00.000Z',
      },
      // 코인 sunset 이후 멤버십 — 다른 소스에 없음 → 포함돼야 함.
      {
        id: 'po-mem',
        order_id: 'ORD-MEM-ONLY',
        package_id: 'membership_premium',
        amount: 49000,
        status: 'fulfilled',
        created_at: '2026-07-03T00:00:00.000Z',
      },
    ],
  });
  assert.equal(result.count, 3); // ent + ct + 멤버십 주문(중복 2건 제외)
  const memEntry = result.entries.find((e) => e.receipt === 'ORD-MEM-ONLY');
  assert.ok(memEntry);
  assert.equal(memEntry.category, '멤버십/구독');
  assert.equal(memEntry.amountWon, 49000);
  assert.equal(memEntry.source, 'payment_orders');
  assert.equal(result.totalSpentWon, 9900 + 9900 + 49000);
});

test('mapCreditTransactionToHistory prefers metadata.amount(실결제액) over catalog price', () => {
  const row: CreditTransactionHistoryRow = {
    id: 'ct-price',
    type: 'purchase',
    amount: 15,
    // 실결제액 8910(예: 프로모션) — 카탈로그 정가 9900 보다 우선해야 함.
    metadata: { packageId: 'credit_15', amount: 8910 },
    created_at: '2026-07-01T00:00:00.000Z',
  };
  assert.equal(mapCreditTransactionToHistory(row).amountWon, 8910);
});

test('isCashCreditTransaction excludes admin manual grants', () => {
  assert.equal(
    isCashCreditTransaction({
      type: 'purchase',
      feature: null,
      metadata: { source: 'admin_manual_grant' },
    }),
    false
  );
  assert.equal(
    isCashCreditTransaction({ type: 'purchase', feature: null, metadata: { source: 'checkout' } }),
    true
  );
  assert.equal(isCashCreditTransaction({ type: 'purchase', feature: null }), true);
});

// 2026-08-27 회귀 가드 — 🔴 사용자 제보: "환불했는데 결제 LTV 가 0원으로 안 바뀐다."
//   revoke_credit_purchase_lots(047)는 lot 만 0 으로 만들고 **원 결제 행은 그대로 둔다.**
//   상품 환불은 이용권 행이 삭제돼 항목이 사라지는데 전(錢) 환불만 남아 비대칭이었다.
test('LTV: 전 결제를 환불하면 totalSpentWon 에서 빠진다', () => {
  const purchase = {
    id: 'tx1',
    type: 'purchase',
    amount: 3,
    created_at: '2026-08-26T13:11:40Z',
    metadata: { paymentKey: 'pk1', orderId: 'ord1', packageId: 'taste_dialogue_entry', amount: 990 },
  } as unknown as CreditTransactionHistoryRow;
  const refundAudit = {
    feature: 'credit_refund',
    metadata: { kind: 'credit_refund', paymentKey: 'pk1', refundAmount: 990 },
  };

  const before = buildPaymentHistory({ productEntitlements: [], creditTransactions: [purchase] });
  assert.equal(before.totalSpentWon, 990);

  const after = buildPaymentHistory({
    productEntitlements: [],
    creditTransactions: [purchase],
    creditRefunds: [refundAudit],
  });
  assert.equal(after.totalSpentWon, 0, '환불했는데 LTV 가 그대로면 순매출이 부풀어 보인다');
  assert.equal(after.grossSpentWon, 990, '총결제는 보존 — 판 사실 자체는 사라지지 않는다');
  assert.equal(after.refundedWon, 990);
  assert.equal(after.entries.length, 1, '이력에서는 결제가 있었던 사실이 남는다');
});

test('LTV: 부분 환불은 환불액만 빠진다', () => {
  const purchase = {
    id: 'tx2',
    type: 'purchase',
    amount: 3,
    created_at: '2026-08-26T13:11:40Z',
    metadata: { paymentKey: 'pk2', packageId: 'taste_dialogue_entry', amount: 990 },
  } as unknown as CreditTransactionHistoryRow;
  const result = buildPaymentHistory({
    productEntitlements: [],
    creditTransactions: [purchase],
    creditRefunds: [{ feature: 'credit_refund', metadata: { refundAmount: 330 } }],
  });
  assert.equal(result.totalSpentWon, 660);
});

// 상품 환불은 이용권 행 삭제 + 주문 refunded 로 이미 항목이 사라진다 → 또 빼면 이중 차감.
test('LTV: entitlement_revoke 감사 행은 차감하지 않는다(이중 차감 방지)', () => {
  const purchase = {
    id: 'tx3',
    type: 'purchase',
    amount: 3,
    created_at: '2026-08-26T13:11:40Z',
    metadata: { paymentKey: 'pk3', packageId: 'taste_dialogue_entry', amount: 990 },
  } as unknown as CreditTransactionHistoryRow;
  const result = buildPaymentHistory({
    productEntitlements: [],
    creditTransactions: [purchase],
    creditRefunds: [{ feature: 'entitlement_revoke', metadata: { amount: 9900 } }],
  });
  assert.equal(result.totalSpentWon, 990);
  assert.equal(result.refundedWon, 0);
});

test('LTV: 데이터가 어긋나도 음수가 되지 않는다', () => {
  const result = buildPaymentHistory({
    productEntitlements: [],
    creditTransactions: [],
    creditRefunds: [{ feature: 'credit_refund', metadata: { refundAmount: 9900 } }],
  });
  assert.equal(result.totalSpentWon, 0);
});

// 🔴 2026-09-01 실사고 — 관리자 사용자조회가 9,900원 번들 결제를 **49,500원 5건**으로 표시했다.
//   원인: 번들 구성품 이용권 5행은 amount=null 인데 금액 폴백이 패키지 정가를 행마다 붙였다.
//   프로덕션 실측 데이터 모양(같은 order_id · amount=null · package_id=bundle_comprehensive)을 그대로 재현한다.
function bundleComponent(id: string, productId: string): ProductEntitlementHistoryRow {
  return {
    id,
    product_id: productId,
    amount: null,
    order_id: 'ord_fa9c72b6',
    payment_key: 'pk_1',
    package_id: 'bundle_comprehensive',
    created_at: '2026-08-30T04:00:00.000Z',
    metadata: null,
  };
}

test('번들 구성품 5행은 주문 금액을 한 번만 계상한다(5배 부풀림 방지)', () => {
  const components = [
    bundleComponent('e1', 'score-total'),
    bundleComponent('e2', 'work-flow'),
    bundleComponent('e3', 'today-detail'),
    bundleComponent('e4', 'money-pattern'),
    bundleComponent('e5', 'year-core'),
  ];
  const result = buildPaymentHistory({
    productEntitlements: components,
    creditTransactions: [],
    paymentOrders: [
      {
        id: 'o1',
        order_id: 'ord_fa9c72b6',
        package_id: 'bundle_comprehensive',
        amount: 9900,
        status: 'fulfilled',
        created_at: '2026-08-30T04:00:00.000Z',
        metadata: null,
      },
    ],
  });

  const price = getPackage('bundle_comprehensive')?.price ?? 9900;
  assert.equal(result.totalSpentWon, price, '번들 정가를 한 번만 세야 한다');
  assert.equal(
    result.entries.filter((e) => (e.amountWon ?? 0) > 0).length,
    1,
    '결제 건수도 1건이어야 한다(구성품 수만큼 세면 안 된다)'
  );
  // 지급 내역 자체는 사라지지 않는다 — 무엇을 받았는지 계속 보여야 한다.
  assert.equal(result.entries.length, 5);
});

test('구성품이 자기 금액을 가지면 그대로 계상한다(단건 결제 회귀 방지)', () => {
  const rows: ProductEntitlementHistoryRow[] = [
    { ...bundleComponent('e1', 'score-total'), amount: 3300, package_id: null, order_id: 'ord_a' },
    { ...bundleComponent('e2', 'today-detail'), amount: 3300, package_id: null, order_id: 'ord_b' },
  ];
  const result = buildPaymentHistory({
    productEntitlements: rows,
    creditTransactions: [],
    paymentOrders: [],
  });
  assert.equal(result.totalSpentWon, 6600);
  assert.equal(result.entries.filter((e) => (e.amountWon ?? 0) > 0).length, 2);
});

// 🔴 2026-09-01 실측 — 취소된 19,800원 주문의 이용권 6행이 회수되지 않은 채 남아
//   LTV 59,400원을 만들었다(원장 완료 0건 = 실제 매출 0원). 금액을 모르는 이용권은
//   주문이 완료로 확인될 때만 정가로 계상해야 한다.
test('취소·환불된 주문의 이용권은 매출로 세지 않는다(금액 추측 금지)', () => {
  const rows: ProductEntitlementHistoryRow[] = [
    { ...bundleComponent('e1', 'today-detail'), order_id: 'ord_canceled', package_id: 'bundle_today_set' },
    { ...bundleComponent('e2', 'score-factor'), order_id: 'ord_canceled', package_id: 'bundle_today_set' },
  ];
  const result = buildPaymentHistory({
    productEntitlements: rows,
    creditTransactions: [],
    // 호출부는 완료 주문만 넘긴다 — 취소 주문은 목록에 없다.
    paymentOrders: [
      {
        id: 'o9',
        order_id: 'ord_other_completed',
        package_id: 'bundle_comprehensive',
        amount: 9900,
        status: 'fulfilled',
        created_at: '2026-08-30T04:00:00.000Z',
        metadata: null,
      },
    ],
  });
  const fromCanceled = result.entries.filter((e) => e.receipt === 'ord_canceled');
  assert.equal(fromCanceled.length, 2, '지급 내역은 남아야 한다');
  assert.equal(
    fromCanceled.reduce((sum, e) => sum + (e.amountWon ?? 0), 0),
    0,
    '취소된 주문은 0원으로 계상해야 한다'
  );
});

test('원장을 넘기지 않는 호출부는 기존 동작(정가 폴백)을 유지한다', () => {
  const result = buildPaymentHistory({
    productEntitlements: [bundleComponent('e1', 'score-total')],
    creditTransactions: [],
  });
  assert.ok((result.totalSpentWon ?? 0) > 0, '근거가 없을 땐 기존처럼 정가로 보강한다');
});
