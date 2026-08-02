import assert from 'node:assert/strict';
import { couponAvailability } from '@/lib/coupons/kakao-friend-coupon';
import type { UserCouponRow } from '@/lib/coupons/kakao-friend-coupon';

declare const test: (name: string, fn: () => void) => void;

const NOW = new Date('2026-08-10T00:00:00Z');
const base: UserCouponRow = {
  id: 'c',
  user_id: 'u',
  type: 'kakao_friend_today_detail',
  status: 'issued',
  issued_at: '2026-08-05T00:00:00Z',
  expires_at: '2026-08-12T00:00:00Z',
  redeemed_at: null,
  redemption_reading_key: null,
  entitlement_id: null,
  verified_kakao_uid: 'k',
};

test('coupon: 판정 — 없음=issuable / 유효=redeemable / 만료 / 사용됨', () => {
  assert.equal(couponAvailability(null, NOW), 'issuable');
  assert.equal(couponAvailability(base, NOW), 'redeemable');
  assert.equal(couponAvailability({ ...base, expires_at: '2026-08-09T00:00:00Z' }, NOW), 'expired');
  assert.equal(couponAvailability({ ...base, status: 'redeemed' }, NOW), 'redeemed');
});
