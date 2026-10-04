import assert from 'node:assert/strict';
import { computePartnerStats } from './partner-stats';

declare const test: (name: string, fn: () => void) => void;

test('computePartnerStats: 수수료 = 남은 결제액 × 스냅샷 수수료율, 전액 환불은 0', () => {
  const stats = computePartnerStats([
    { amount: 19200, status: 'fulfilled', metadata: { partnerCode: 'mina', partnerCommissionPercent: 30 } },
    { amount: 19200, status: 'refunded', metadata: { partnerCode: 'mina', partnerCommissionPercent: 30 } },
    { amount: 19200, status: 'fulfilled', metadata: { partnerCode: 'mina', partnerCommissionPercent: 30, partialRefunds: [{ amount: 9200 }] } },
    { amount: 9900, status: 'fulfilled', metadata: {} },
  ]);
  assert.deepEqual(stats.mina, {
    paidCount: 3,
    paidWon: 57600,
    refundedCount: 2,
    refundedWon: 19200 + 9200,
    commissionWon: Math.floor(19200 * 0.3) + Math.floor(10000 * 0.3),
  });
  assert.equal(Object.keys(stats).length, 1, '파트너 없는 주문은 제외');
});
