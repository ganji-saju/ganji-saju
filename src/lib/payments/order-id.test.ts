import assert from 'node:assert/strict';
import { buildTossOrderId, isValidTossOrderId } from './order-id';

declare const test: (name: string, fn: () => void) => void;

test('toss order id stays within Toss length limit for personality compatibility mini', () => {
  const orderId = buildTossOrderId({
    prefix: 'membership',
    packageId: 'taste_personality_compatibility_mini',
    paymentMethod: 'TRANSFER',
    now: 1778490744154,
    nonce: 'abcdef',
  });

  assert.equal(isValidTossOrderId(orderId), true);
  assert.ok(orderId.length <= 64);
  assert.match(orderId, /^membersh_pcmini_tr_1778490744154_abcdef$/);
});

test('toss order id hashes unknown long package ids safely', () => {
  const orderId = buildTossOrderId({
    prefix: 'membership',
    packageId: 'very_long_future_package_id_that_could_exceed_toss_order_id_limit',
    paymentMethod: 'CARD',
    now: 1778490744154,
    nonce: 'xyz',
  });

  assert.equal(isValidTossOrderId(orderId), true);
  assert.ok(orderId.length <= 64);
});
