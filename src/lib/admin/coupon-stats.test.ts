// 카카오 친구추가 쿠폰 현황 순수 헬퍼 회귀 가드(상태 라벨 + 사용률).
import assert from 'node:assert/strict';
import { couponRecentStatus, couponRedeemRate } from './coupon-stats';

declare const test: (name: string, fn: () => void) => void;

const NOW = new Date('2026-08-03T00:00:00.000Z');
const FUTURE = '2026-08-10T00:00:00.000Z';
const PAST = '2026-08-01T00:00:00.000Z';

test('쿠폰상태: redeemed 는 만료여부 무관하게 사용', () => {
  assert.deepEqual(couponRecentStatus('redeemed', PAST, NOW), { key: 'redeemed', label: '사용' });
  assert.deepEqual(couponRecentStatus('redeemed', FUTURE, NOW), { key: 'redeemed', label: '사용' });
});

test('쿠폰상태: issued + 미래만료 = 유효, 과거만료 = 만료', () => {
  assert.deepEqual(couponRecentStatus('issued', FUTURE, NOW), { key: 'active', label: '유효' });
  assert.deepEqual(couponRecentStatus('issued', PAST, NOW), { key: 'expired', label: '만료' });
});

test('쿠폰상태: 만료시각 == now 는 만료(경계 포함, couponAvailability 와 정합)', () => {
  assert.deepEqual(
    couponRecentStatus('issued', NOW.toISOString(), NOW),
    { key: 'expired', label: '만료' }
  );
});

test('사용률: redeemed/total, 발급 0건이면 null(0% 오표시 방지)', () => {
  assert.equal(couponRedeemRate(3, 10), 0.3);
  assert.equal(couponRedeemRate(0, 4), 0);
  assert.equal(couponRedeemRate(0, 0), null);
  assert.equal(couponRedeemRate(5, 0), null);
});
