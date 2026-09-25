import assert from 'node:assert/strict';
import { MEMBER_DISCOUNT_PERCENT_BY_PACKAGE, pickBetterDiscount } from './member-discount';

declare const test: (name: string, fn: () => void) => void;

test('member-discount — 신년운세만 멤버십 50%', () => {
  assert.equal(MEMBER_DISCOUNT_PERCENT_BY_PACKAGE.taste_new_year_2027, 50);
  assert.equal(MEMBER_DISCOUNT_PERCENT_BY_PACKAGE.taste_today_detail, undefined);
});

test('member-discount — 쿠폰과 겹치면 할인액 큰 쪽, 동률은 멤버십', () => {
  assert.equal(pickBetterDiscount(19900, 50, { percent: 30 }), 'member');
  assert.equal(pickBetterDiscount(19900, 50, { percent: 50 }), 'member');
  assert.equal(pickBetterDiscount(19900, 50, { percent: 60, maxDiscountWon: 5000 }), 'member');
  assert.equal(pickBetterDiscount(19900, 0, { percent: 10 }), 'coupon');
  assert.equal(pickBetterDiscount(19900, 0, null), 'none');
});
