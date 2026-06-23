import assert from 'node:assert/strict';
import {
  generatePaymentOrderId,
  getTossPaymentAmount,
  isValidServerOrderId,
  validateTossPaymentAgainstOrder,
  type PaymentOrder,
} from './order-ledger';

declare const test: (name: string, fn: () => void) => void;

function baseOrder(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: 'id',
    orderId: 'ord_018d64b1-2bd7-4f96-a6ce-0f9d0ef34300',
    userId: 'user-id',
    packageId: 'credit_15',
    amount: 500,
    currency: 'KRW',
    status: 'prepared',
    paymentKey: null,
    tossStatus: null,
    tossPayment: null,
    slug: null,
    scope: null,
    product: null,
    plan: null,
    entrySource: 'credits',
    paymentMethodCode: 'CARD',
    acceptedPolicyKinds: ['terms', 'privacy', 'refund', 'coin'],
    recordedPolicyVersionIds: [],
    metadata: {},
    lastError: null,
    fulfillmentAttempts: 0,
    reconciliationAttempts: 0,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    confirmedAt: null,
    fulfilledAt: null,
    failedAt: null,
    lastReconciledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test('server-generated Toss orderId uses only allowed characters and length', () => {
  const orderId = generatePaymentOrderId();

  assert.equal(isValidServerOrderId(orderId), true);
  assert.ok(orderId.startsWith('ord_'));
  assert.ok(orderId.length >= 6 && orderId.length <= 64);
});

test('Toss payment validation accepts matching orderId, amount, and currency', () => {
  const result = validateTossPaymentAgainstOrder(baseOrder(), {
    orderId: 'ord_018d64b1-2bd7-4f96-a6ce-0f9d0ef34300',
    paymentKey: 'pay_123',
    status: 'DONE',
    totalAmount: 500,
    currency: 'KRW',
  });

  assert.deepEqual(result, { ok: true });
});

test('Toss payment validation rejects orderId mismatch', () => {
  const result = validateTossPaymentAgainstOrder(baseOrder(), {
    orderId: 'ord_other',
    paymentKey: 'pay_123',
    status: 'DONE',
    totalAmount: 500,
    currency: 'KRW',
  });

  assert.equal(result.ok, false);
});

test('Toss payment validation rejects amount mismatch', () => {
  const result = validateTossPaymentAgainstOrder(baseOrder(), {
    orderId: 'ord_018d64b1-2bd7-4f96-a6ce-0f9d0ef34300',
    paymentKey: 'pay_123',
    status: 'DONE',
    totalAmount: 501,
    currency: 'KRW',
  });

  assert.equal(result.ok, false);
});

test('getTossPaymentAmount prefers totalAmount and falls back to amount', () => {
  assert.equal(getTossPaymentAmount({ totalAmount: 990, amount: 100 }), 990);
  assert.equal(getTossPaymentAmount({ amount: 100 }), 100);
  assert.equal(getTossPaymentAmount({}), null);
});
