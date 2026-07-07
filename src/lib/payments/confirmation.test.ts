import assert from 'node:assert/strict';
import { validatePaymentConfirmationPayload } from './confirmation';
import { getCreditGrantType, getPackage, isSubscriptionPackage } from './catalog';

declare const test: (name: string, fn: () => void) => void;

test('payment confirmation accepts a valid subscription package', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 49000,
    packageId: 'membership_premium',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.input.pkg.kind, 'subscription');
  assert.equal(result.input.pkg.subscriptionPlan, 'premium_monthly');
  assert.equal(result.input.slug, null);
  assert.equal(result.input.scope, null);
});

test('managed membership packages grant subscription credits', () => {
  const pkg = getPackage('membership_plus');

  assert.ok(pkg);
  assert.equal(isSubscriptionPackage(pkg), true);
  assert.equal(getCreditGrantType(pkg), 'subscription');
});

test('payment confirmation accepts a known package regardless of quoted amount (route enforces order.amount)', () => {
  // 2026-07-07 — 정확 금액 정합은 confirm/route 의 order.amount(prepare 스냅샷) 비교로 이동.
  //   payload 검증은 known package + 양수 amount 만 강제(가격 변경 시 정상 주문 통과).
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 100,
    packageId: 'membership_premium',
  });

  assert.equal(result.ok, true);
});

test('payment confirmation rejects non-positive amount', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 0,
    packageId: 'membership_premium',
  });

  assert.equal(result.ok, false);
});

test('lifetime report confirmation callback can omit slug because order ledger owns scope', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 49000,
    packageId: 'lifetime_report',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.input.slug, null);
});

test('lifetime report confirmation trims the reading slug used for entitlement', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 49000,
    packageId: 'lifetime_report',
    slug: '  1982-1-29-8-male  ',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.input.pkg.kind, 'lifetime_report');
  assert.equal(result.input.slug, '1982-1-29-8-male');
});

test('taste product confirmation accepts product package with slug and scope', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 9900,
    packageId: 'taste_monthly_calendar',
    slug: 'reading-123',
    scope: '2026-05',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.input.pkg.kind, 'taste_product');
  assert.equal(result.input.pkg.tasteProductId, 'monthly-calendar');
  assert.equal(result.input.slug, 'reading-123');
  assert.equal(result.input.scope, '2026-05');
});

test('scoped taste product confirmation callback can omit slug because order ledger owns scope', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 9900,
    packageId: 'taste_year_core',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.input.slug, null);
});
