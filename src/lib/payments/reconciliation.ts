import { confirmPayment } from '@/lib/payments/toss';
import {
  attachPaymentKeyToOrder,
  markPaymentOrderConfirmed,
  markPaymentOrderFailed,
  type PaymentOrder,
  type PaymentOrderSource,
  type TossPaymentObject,
  validateTossPaymentAgainstOrder,
} from '@/lib/payments/order-ledger';
import { fulfillPaymentOrder, type PaymentFulfillmentResult } from '@/lib/payments/fulfillment';
// 2026-07-04 admin 지표 감사 — 웹훅/정산 경유 fulfillment 가 퍼널에 전무해, confirm 라우트를
// 못 탄 성공 건(결제 후 브라우저 이탈)이 원장에는 있는데 confirm_success 는 0 이던 괴리 수정.
import { logPaymentFunnelEvent } from '@/lib/payments/funnel-log';
import { createClient } from '@/lib/supabase/server';

export type PaymentReconciliationResult =
  | { status: 'fulfilled'; fulfillment: PaymentFulfillmentResult }
  | { status: 'pending'; reason: string }
  | { status: 'closed'; reason: string };

function terminalFailureStatus(status: string | null | undefined) {
  if (!status) return null;
  if (status === 'EXPIRED') return 'expired';
  if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') return 'canceled';
  if (status === 'ABORTED') return 'payment_failed';
  return null;
}

export async function settlePaymentOrderFromToss(input: {
  order: PaymentOrder;
  payment: TossPaymentObject;
  source: PaymentOrderSource;
}): Promise<PaymentReconciliationResult> {
  const validation = validateTossPaymentAgainstOrder(input.order, input.payment);
  if (!validation.ok) {
    await markPaymentOrderFailed({
      orderId: input.order.orderId,
      status: 'fulfillment_failed',
      error: validation.error,
      source: input.source,
      payment: input.payment,
    });
    throw new Error(validation.error);
  }

  const paymentKey = input.payment.paymentKey;
  if (!paymentKey) {
    return { status: 'pending', reason: 'payment_key_missing' };
  }

  if (input.order.status === 'fulfilled') {
    return { status: 'closed', reason: 'already_fulfilled' };
  }

  if (input.order.status === 'fulfilling') {
    return { status: 'pending', reason: 'fulfillment_in_progress' };
  }

  let order = await attachPaymentKeyToOrder({
    order: input.order,
    paymentKey,
    source: input.source,
  });

  const closedStatus = terminalFailureStatus(input.payment.status);
  if (closedStatus) {
    if (order.status === 'fulfilled') {
      return { status: 'closed', reason: input.payment.status ?? closedStatus };
    }
    await markPaymentOrderFailed({
      orderId: order.orderId,
      status: closedStatus,
      error: `Toss payment status: ${input.payment.status}`,
      source: input.source,
      payment: input.payment,
    });
    return { status: 'closed', reason: input.payment.status ?? closedStatus };
  }

  const confirmedPayment =
    input.payment.status === 'IN_PROGRESS'
      ? await confirmPayment(paymentKey, order.orderId, order.amount)
      : input.payment;

  if (confirmedPayment.status !== 'DONE') {
    return { status: 'pending', reason: confirmedPayment.status ?? 'unknown_status' };
  }

  order = await markPaymentOrderConfirmed({
    orderId: order.orderId,
    payment: confirmedPayment,
    source: input.source,
  });

  if (order.status === 'fulfilled') {
    return { status: 'closed', reason: 'already_fulfilled' };
  }

  if (order.status === 'fulfilling') {
    return { status: 'pending', reason: 'fulfillment_in_progress' };
  }

  const fulfillment = await fulfillPaymentOrder({
    order,
    payment: confirmedPayment,
    source: input.source,
  });

  // 신규 fulfillment 일 때만 도달(이미 지급이면 위에서 조기반환) — confirm 라우트 성공과
  // 중복 기록되지 않는다. best-effort(퍼널 로그 실패가 정산을 막지 않도록).
  try {
    await logPaymentFunnelEvent(await createClient(), {
      stage: 'confirm_success',
      userId: order.userId,
      packageId: order.packageId,
      amount: order.amount,
      orderId: order.orderId,
      metadata: { source: input.source },
    });
  } catch {
    // 비차단.
  }

  return { status: 'fulfilled', fulfillment };
}
