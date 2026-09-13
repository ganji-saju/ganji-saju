import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildUserLlmStats,
  determineRefundEligibility,
  extractPalja,
} from './user-detail';
import { buildOrderAmountMap, determineCreditRefundEligibility } from './credit-refunds';

// 2026-05-25 Phase 1 — 어드민 사용자 상세 순수 로직.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('extractPalja: 4기둥 ganzi → 8글자', () => {
  const data = calculateSajuDataV1({ year: 1999, month: 4, day: 1, hour: 14, gender: 'female' });
  const palja = extractPalja(data);
  assert.equal(palja.year, data.pillars.year.ganzi);
  assert.equal(palja.month, data.pillars.month.ganzi);
  assert.equal(palja.day, data.pillars.day.ganzi);
  assert.equal(palja.hour, data.pillars.hour?.ganzi ?? null);
  assert.equal(palja.eightChar.length, 8); // 4 ganzi × 2자
  assert.equal(palja.eightChar, [palja.year, palja.month, palja.day, palja.hour].join(''));
});

test('extractPalja: 시주 미입력 → hour null, 6글자', () => {
  const noHour = {
    pillars: {
      year: { ganzi: '갑자' },
      month: { ganzi: '을축' },
      day: { ganzi: '병인' },
      hour: null,
    },
  } as unknown as Parameters<typeof extractPalja>[0];
  const palja = extractPalja(noHour);
  assert.equal(palja.hour, null);
  assert.equal(palja.eightChar, '갑자을축병인');
  assert.equal(palja.eightChar.length, 6);
});

test('buildUserLlmStats: feature별 source 카운트 + 비용 합', () => {
  const rows = [
    { feature: 'lifetime', source: 'openai', cost_usd: 0.01 },
    { feature: 'lifetime', source: 'cache', cost_usd: 0 },
    { feature: 'lifetime', source: 'cache', cost_usd: 0 },
    { feature: 'chat', source: 'fallback', cost_usd: 0 },
    { feature: 'chat', source: 'openai', cost_usd: 0.002 },
  ];
  const stats = buildUserLlmStats(rows);
  const lifetime = stats.find((s) => s.feature === 'lifetime');
  const chat = stats.find((s) => s.feature === 'chat');
  assert.equal(lifetime?.openai, 1);
  assert.equal(lifetime?.cache, 2);
  assert.equal(lifetime?.fallback, 0);
  assert.equal(lifetime?.costUsd, 0.01);
  assert.equal(chat?.openai, 1);
  assert.equal(chat?.fallback, 1);
  assert.equal(Math.round((chat?.costUsd ?? 0) * 1000) / 1000, 0.002);
});

test('determineRefundEligibility: amount>0 만 환불 대상, 합계', () => {
  const entitlements = [
    { id: 'a', product_id: 'lifetime-report', amount: 49000, order_id: 'o1', payment_key: 'pk1', package_id: null, created_at: '2026-05-01T00:00:00Z', metadata: null },
    { id: 'b', product_id: 'today-detail', amount: 550, order_id: null, payment_key: 'pk2', package_id: null, created_at: '2026-05-02T00:00:00Z', metadata: null },
    { id: 'c', product_id: 'freebie', amount: 0, order_id: null, payment_key: null, package_id: null, created_at: '2026-05-03T00:00:00Z', metadata: null },
  ];
  const result = determineRefundEligibility(entitlements, undefined, []);
  assert.equal(result.items.length, 2); // amount 0 인 c 제외
  assert.equal(result.totalRefundableWon, 49550);
  assert.equal(result.totalProductRefundableWon, 49550);
  assert.equal(result.totalCreditRefundableWon, 0);
  const a = result.items.find((i) => i.id === 'a');
  assert.equal(a?.productName, '보관형 사주 리포트');
  assert.equal(a?.hasPaymentKey, true);
});

test('determineCreditRefundEligibility: 미사용/일부사용/전부사용 전 환불 금액 계산', () => {
  const now = new Date('2026-05-27T00:00:00Z');
  const txRows = [
    {
      id: 'tx-full',
      type: 'purchase',
      amount: 15,
      metadata: { paymentKey: 'pk-full', orderId: 'ord-full', packageId: 'credit_15' },
      created_at: '2026-05-20T00:00:00Z',
      feature: null,
    },
    {
      id: 'tx-partial',
      type: 'purchase',
      amount: 15,
      metadata: { paymentKey: 'pk-partial', orderId: 'ord-partial', packageId: 'credit_15' },
      created_at: '2026-05-21T00:00:00Z',
      feature: null,
    },
    {
      id: 'tx-empty',
      type: 'purchase',
      amount: 15,
      metadata: { paymentKey: 'pk-empty', orderId: 'ord-empty', packageId: 'credit_15' },
      created_at: '2026-05-22T00:00:00Z',
      feature: null,
    },
  ];
  const lots = [
    {
      id: 'lot-full',
      amount_remaining: 15,
      amount_initial: 15,
      expires_at: '2027-05-20T00:00:00Z',
      source: 'purchase',
      metadata: { paymentKey: 'pk-full', orderId: 'ord-full', packageId: 'credit_15' },
      created_at: '2026-05-20T00:00:00Z',
    },
    {
      id: 'lot-partial',
      amount_remaining: 5,
      amount_initial: 15,
      expires_at: '2027-05-21T00:00:00Z',
      source: 'purchase',
      metadata: { paymentKey: 'pk-partial', orderId: 'ord-partial', packageId: 'credit_15' },
      created_at: '2026-05-21T00:00:00Z',
    },
    {
      id: 'lot-empty',
      amount_remaining: 0,
      amount_initial: 15,
      expires_at: '2027-05-22T00:00:00Z',
      source: 'purchase',
      metadata: { paymentKey: 'pk-empty', orderId: 'ord-empty', packageId: 'credit_15' },
      created_at: '2026-05-22T00:00:00Z',
    },
  ];

  const result = determineCreditRefundEligibility(txRows, lots, now);
  assert.equal(result.items.length, 3);
  assert.equal(result.refundableItems.length, 2);
  assert.equal(result.items.find((i) => i.id === 'tx-full')?.status, 'full');
  assert.equal(result.items.find((i) => i.id === 'tx-full')?.refundAmountWon, 9900);
  assert.equal(result.items.find((i) => i.id === 'tx-partial')?.status, 'partial');
  assert.equal(result.items.find((i) => i.id === 'tx-partial')?.refundAmountWon, 3300);
  assert.equal(result.items.find((i) => i.id === 'tx-empty')?.status, 'none');
  assert.equal(result.totalRefundableWon, 13200);
});

// 2026-08-24 — 번들 주문 환불 가시성 가드. 번들 grant 는 구성품 amount=null 이라
//   entitlement 기준으로는 환불 목록에 절대 안 잡힌다(실제로 종합 리포트 테스트 주문이
//   admin 환불 탭에 안 떠서 발견). 주문 원장 기반 항목이 이를 대신한다.
test('번들 주문은 주문 단위로 환불 목록에 잡힌다', () => {
  const refund = determineRefundEligibility(
    [
      // 🔴 2026-08-27 — 중복 방지는 "단품이라서" 가 아니라 **이미 잡혔기 때문**이다.
      //   직전 테스트는 이용권을 비워둔 채 단품 주문이 빠지는 걸 단언해, 이용권이 사라진
      //   주문(고아 주문)까지 영영 못 잡는 동작을 고정하고 있었다. 실제 중복 상황으로 바꾼다.
      {
        id: 'ent-dup',
        product_id: 'today-detail',
        scope_key: null,
        amount: 3300,
        payment_key: 'tid-sandbox-2',
        order_id: 'ord_20260824_2',
        created_at: '2026-08-24T13:00:00Z',
      } as never,
    ],
    undefined,
    [
      {
        id: 'order-row-1',
        order_id: 'ord_20260824_1',
        package_id: 'bundle_today_set',
        amount: 9900,
        payment_key: 'tid-sandbox-1',
        created_at: '2026-08-24T12:00:00Z',
      },
      {
        // 같은 주문이 이용권으로 이미 잡혔으므로 주문 기반으로는 제외돼야 한다.
        id: 'order-row-2',
        order_id: 'ord_20260824_2',
        package_id: 'taste_today_detail',
        amount: 3300,
        payment_key: 'tid-sandbox-2',
        created_at: '2026-08-24T13:00:00Z',
      },
    ]
  );
  assert.equal(refund.items.filter((i) => i.kind === 'bundle-order').length, 1);
  assert.equal(refund.items.find((i) => i.kind === 'bundle-order')?.kind, 'bundle-order');
  const bundleItem = refund.items.find((i) => i.kind === 'bundle-order');
  assert.equal(bundleItem?.productName, '오늘 풀세트');
  assert.equal(bundleItem?.amountWon, 9900);
  assert.equal(bundleItem?.paymentKey, 'tid-sandbox-1');
  assert.equal(refund.totalProductRefundableWon, 9900 + 3300);
});

// 🔴 2026-08-27 실측(test1111): product_entitlements 0행인데 taste_tarot_daily·
//   taste_today_basic 주문이 status='fulfilled' 로 남아 있었다. 이용권이 사라져
//   환불 목록 어디에도 안 잡히니 **환불할 방법이 없고**, LTV 에는 계속 잡혀
//   "환불했는데 금액이 안 사라진다" 로 보였다. 금액은 이용권이 아니라 주문에 있다.
test('이용권이 사라진 단품 주문도 환불 목록에 잡힌다(고아 주문)', () => {
  const refund = determineRefundEligibility([], undefined, [
    {
      id: 'order-orphan',
      order_id: 'ord_orphan_1',
      package_id: 'taste_tarot_daily',
      amount: 990,
      payment_key: 'tid-orphan',
      created_at: '2026-08-25T17:26:20Z',
    },
  ]);
  assert.equal(refund.items.length, 1, '이용권이 없다고 환불 자체를 못 하면 안 된다');
  assert.equal(refund.items[0].amountWon, 990);
  assert.equal(refund.items[0].paymentKey, 'tid-orphan');
  assert.equal(refund.totalProductRefundableWon, 990);
});

// 🔴 설계 §13-9 — 할인 결제의 환불액은 실결제액(order.amount)이다. 위 픽스처들은 금액이 카탈로그가와 같아
//   "정가로 환불" 회귀가 초록으로 지나간다 → 카탈로그가(오늘 자세히 3,300 · 종합 리포트 9,900)와 **다른** 할인가로 고정한다.
//   2026-09-13 — 구성품(amount=null)이 지급된 번들 주문이 목록에서 통째로 빠지고 있었다(관리자 화면으로 환불 불가):
//   구성품의 주문번호까지 "이미 잡힌 주문"으로 셌기 때문이다. 구성품은 금액이 없어 목록에 없다.
//   금액 기록 없는 단품 이용권의 주문도 같다 — 주문 단위 환불이 결제키로 그 이용권까지 회수한다(2026-09-13, 전엔 패키지 id 라 못 지웠다).
test('환불 목록 금액은 할인 후 실결제액 — 단품 이용권 · 구성품이 지급된 번들 · 고아 주문(§13-9)', () => {
  const component = (id: string, productId: string) =>
    ({ id, product_id: productId, scope_key: null, amount: null, payment_key: 'pk_b', order_id: 'ord_b', created_at: '2026-09-13T01:00:00Z' }) as never;
  const refund = determineRefundEligibility(
    [
      { id: 'ent-d', product_id: 'today-detail', scope_key: null, amount: 2970, payment_key: 'pk_d', order_id: 'ord_d', created_at: '2026-09-13T02:00:00Z' } as never,
      component('c1', 'score-total'),
      component('c2', 'work-flow'),
      component('c3', 'today-detail'),
      { id: 'ent-n', product_id: 'today-detail', scope_key: null, amount: null, payment_key: 'pk_n', order_id: 'ord_n', created_at: '2026-09-12T00:00:00Z' } as never,
    ],
    undefined,
    [
      { id: 'row-b', order_id: 'ord_b', package_id: 'bundle_comprehensive', amount: 8910, payment_key: 'pk_b', created_at: '2026-09-13T01:00:00Z' },
      { id: 'row-n', order_id: 'ord_n', package_id: 'taste_today_detail', amount: 2970, payment_key: 'pk_n', created_at: '2026-09-12T00:00:00Z' },
      { id: 'row-o', order_id: 'ord_o', package_id: 'taste_today_detail', amount: 2970, payment_key: 'pk_o', created_at: '2026-09-13T00:00:00Z' },
      // 이용권으로 이미 잡힌 주문 — 두 번 세지 않는다.
      { id: 'row-d', order_id: 'ord_d', package_id: 'taste_today_detail', amount: 2970, payment_key: 'pk_d', created_at: '2026-09-13T02:00:00Z' },
    ]
  );
  const amountsOf = (orderId: string) => refund.items.filter((i) => i.orderId === orderId).map((i) => i.amountWon);
  assert.deepEqual(amountsOf('ord_d'), [2970], '단품 이용권');
  assert.deepEqual(amountsOf('ord_b'), [8910], '구성품이 지급된 번들');
  assert.deepEqual(amountsOf('ord_o'), [2970], '이용권이 사라진 주문');
  assert.deepEqual(amountsOf('ord_n'), [2970], '금액 기록 없는 단품 이용권이 남은 주문 — 환불 창구가 없으면 안 된다');
  assert.equal(refund.totalProductRefundableWon, 2970 + 8910 + 2970 + 2970);
});

// 2026-08-26 회귀 가드 — 🔴 사용자 제보: "990원 결제하고 대화 3번 안 했는데 이미 사용된 거라고
//   환불이 안 된다"(실측 전 잔액 6전 그대로). lot 을 못 이었을 뿐인데 '전부 사용됨'으로 뒤집혔다.
test('creditRefund: lot 을 못 이으면 "전부 사용됨"이 아니라 "연결 실패"로 표기한다', () => {
  const now = new Date('2026-08-26T00:00:00.000Z');
  const tx = {
    id: 'tx-1',
    type: 'purchase',
    amount: 3,
    created_at: '2026-08-26T00:00:00.000Z',
    metadata: { paymentKey: 'pk-990', orderId: 'ord-990', packageId: 'taste_dialogue_entry', amount: 990 },
  };
  // lot 은 존재하지만 metadata 가 끊겨 paymentKey·orderId 어느 쪽으로도 안 이어진다.
  const orphan = {
    id: 'lot-x',
    amount_remaining: 3,
    amount_initial: 3,
    expires_at: '2027-08-26T00:00:00.000Z',
    source: 'purchase',
    created_at: '2026-08-26T00:00:00.000Z',
    metadata: {},
  };
  const [item] = determineCreditRefundEligibility([tx], [orphan], now).items;
  assert.equal(item.lotsLinked, false);
  assert.equal(item.coinsUsed, 0, '못 이은 것을 사용으로 세면 안 된다');
  assert.ok(!item.statusLabel.includes('전부 사용됨'), item.statusLabel);
  assert.ok(item.statusLabel.includes('확인 필요'), item.statusLabel);
});

// paymentKey 가 한쪽에서 비어도 orderId 로 이어지면 잔여 전이 그대로 읽혀야 한다.
test('creditRefund: paymentKey 가 끊겨도 orderId 로 이어 전액 환불을 살린다', () => {
  const now = new Date('2026-08-26T00:00:00.000Z');
  const tx = {
    id: 'tx-2',
    type: 'purchase',
    amount: 3,
    created_at: '2026-08-26T00:00:00.000Z',
    metadata: { paymentKey: 'pk-990', orderId: 'ord-990', packageId: 'taste_dialogue_entry', amount: 990 },
  };
  const lot = {
    id: 'lot-y',
    amount_remaining: 3,
    amount_initial: 3,
    expires_at: '2027-08-26T00:00:00.000Z',
    source: 'purchase',
    created_at: '2026-08-26T00:00:00.000Z',
    metadata: { orderId: 'ord-990' },
  };
  const [item] = determineCreditRefundEligibility([tx], [lot], now).items;
  assert.equal(item.lotsLinked, true);
  assert.equal(item.status, 'full');
  assert.equal(item.refundAmountWon, 990);
});

// 🔴 2026-09-11 — 전 결제 환불이 **카탈로그 정가**로 계산되던 버그.
//   fulfillment 가 addCredits metadata 에 amount 를 안 실어 credit-refunds 의
//   `?? pkg?.price` 폴백이 100% 탔다. 990원 결제 = 990원 정가라 우연히 같아서 안 보였다.
//   가격이 **다를 때** 만 드러나므로 그 조건으로 고정한다.
test('creditRefund: metadata.amount 가 없으면 주문 원장의 실결제액을 쓴다(정가 아님)', () => {
  const now = new Date('2026-09-11T00:00:00.000Z');
  const tx = {
    id: 'tx-disc',
    type: 'purchase',
    amount: 3,
    created_at: '2026-09-11T00:00:00.000Z',
    // amount 없음 = 현재 프로덕션에 쌓여 있는 모든 행의 모습
    metadata: { paymentKey: 'pk-1', orderId: 'ord-1', packageId: 'taste_dialogue_entry' },
  };
  const lot = {
    id: 'lot-disc',
    amount_remaining: 3,
    amount_initial: 3,
    expires_at: '2027-09-11T00:00:00.000Z',
    source: 'purchase',
    created_at: '2026-09-11T00:00:00.000Z',
    metadata: { orderId: 'ord-1' },
  };
  // 실결제 495원(정가 990원의 50%) — 정가로 환불하면 495원을 과다환불한다.
  const orderAmounts = buildOrderAmountMap([{ order_id: 'ord-1', amount: 495 }]);

  const [withMap] = determineCreditRefundEligibility([tx], [lot], now, orderAmounts).items;
  assert.equal(withMap.refundAmountWon, 495, '주문 원장의 실결제액이 쓰여야 한다');

  // 맵이 없으면(레거시 행·주문 조회 실패) 종전대로 정가 폴백 — 기존 동작 보존.
  const [noMap] = determineCreditRefundEligibility([tx], [lot], now).items;
  assert.equal(noMap.refundAmountWon, 990, '폴백 제거는 기존 환불을 통째로 막으므로 최후 수단으로 남긴다');
});

test('creditRefund: metadata.amount 가 있으면 주문 원장보다 우선한다', () => {
  const now = new Date('2026-09-11T00:00:00.000Z');
  const tx = {
    id: 'tx-meta',
    type: 'purchase',
    amount: 3,
    created_at: '2026-09-11T00:00:00.000Z',
    metadata: { paymentKey: 'pk-2', orderId: 'ord-2', packageId: 'taste_dialogue_entry', amount: 660 },
  };
  const lot = {
    id: 'lot-meta',
    amount_remaining: 3,
    amount_initial: 3,
    expires_at: '2027-09-11T00:00:00.000Z',
    source: 'purchase',
    created_at: '2026-09-11T00:00:00.000Z',
    metadata: { orderId: 'ord-2' },
  };
  const [item] = determineCreditRefundEligibility(
    [tx],
    [lot],
    now,
    buildOrderAmountMap([{ order_id: 'ord-2', amount: 495 }])
  ).items;
  assert.equal(item.refundAmountWon, 660);
});

test('buildOrderAmountMap: order_id·양수 amount 인 행만 담는다', () => {
  const map = buildOrderAmountMap([
    { order_id: 'a', amount: 3300 },
    { order_id: 'b', amount: 0 },
    { order_id: null, amount: 990 },
    { order_id: 'c', amount: null },
  ]);
  assert.equal(map.get('a'), 3300);
  assert.equal(map.has('b'), false, '0원 주문은 담지 않는다');
  assert.equal(map.has('c'), false);
  assert.equal(map.size, 1);
});
