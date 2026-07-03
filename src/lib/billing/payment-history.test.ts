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
  assert.equal(pkgFallback.amountWon, 9900);

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
    amount: 2,
    metadata: { packageId: 'membership_plus', orderId: 'ORD-MEM' },
    created_at: '2026-05-17T00:00:00.000Z',
  };
  const mem = mapCreditTransactionToHistory(membership);
  assert.equal(mem.category, '멤버십/구독');
  assert.equal(mem.productName, '라이트 대화 멤버십');
  assert.equal(mem.amountWon, 4900);
  assert.equal(mem.coins, 2);
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
