import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildUserLlmStats,
  determineRefundEligibility,
  extractPalja,
} from './user-detail';
import { determineCreditRefundEligibility } from './credit-refunds';

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
  const result = determineRefundEligibility(entitlements);
  assert.equal(result.items.length, 2); // amount 0 인 c 제외
  assert.equal(result.totalRefundableWon, 49550);
  assert.equal(result.totalProductRefundableWon, 49550);
  assert.equal(result.totalCreditRefundableWon, 0);
  const a = result.items.find((i) => i.id === 'a');
  assert.equal(a?.productName, '보관형 사주 리포트');
  assert.equal(a?.hasPaymentKey, true);
});

test('determineCreditRefundEligibility: 미사용/일부사용/전부사용 코인 환불 금액 계산', () => {
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
