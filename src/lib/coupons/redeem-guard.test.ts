import assert from 'node:assert/strict';
import { redeemPreconditions } from '@/lib/coupons/kakao-friend-coupon';

declare const test: (name: string, fn: () => void) => void;

test('coupon redeem 가드', () => {
  assert.deepEqual(redeemPreconditions(false, true, 'redeemable'), {
    ok: false,
    status: 404,
    error: 'disabled',
  });
  assert.deepEqual(redeemPreconditions(true, false, 'redeemable'), {
    ok: false,
    status: 401,
    error: 'unauthorized',
  });
  assert.deepEqual(redeemPreconditions(true, true, 'expired'), {
    ok: false,
    status: 409,
    error: 'not_redeemable',
  });
  assert.deepEqual(redeemPreconditions(true, true, 'redeemable'), { ok: true });
});
