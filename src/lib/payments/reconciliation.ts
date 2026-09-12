import { confirmPayment } from '@/lib/payments/toss';
import {
  attachPaymentKeyToOrder,
  markPaymentOrderConfirmed,
  markPaymentOrderFailed,
  markPaymentOrderRefunded,
  type PaymentOrder,
  type PaymentOrderSource,
  type TossPaymentObject,
  validateTossPaymentAgainstOrder,
} from '@/lib/payments/order-ledger';
import { resolveCancellationTerminalStatus } from '@/lib/payments/cancellation';
import { fulfillPaymentOrder, type PaymentFulfillmentResult } from '@/lib/payments/fulfillment';
// 2026-07-04 admin 지표 감사 — 웹훅/정산 경유 fulfillment 가 퍼널에 전무해, confirm 라우트를
// 못 탄 성공 건(결제 후 브라우저 이탈)이 원장에는 있는데 confirm_success 는 0 이던 괴리 수정.
import { logPaymentFunnelEvent } from '@/lib/payments/funnel-log';
import { checkBeforePgApproval } from '@/lib/payments/coupon-order-guard';
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

  // 세 번째 승인 경로 — 사용자가 인증만 마치고 창을 닫으면(토스 IN_PROGRESS) 정산·웹훅이 아래에서 직접 승인한다.
  //   confirm·나이스 return 과 같은 관문을 **결제 키를 붙이기 전에** 돌린다(붙인 뒤면 confirm 이 "승인 요청이 나갔을 수 있다"로
  //   보고 쿠폰 검사를 건너뛴다). 토스 IN_PROGRESS 는 아직 승인 전이다. 막히면 상태를 건드리지 않고 두면 토스가 만료시킨다.
  if (input.payment.status === 'IN_PROGRESS') {
    const approvalBlock = await checkBeforePgApproval(input.order, { approvalMayHaveBeenRequested: false });
    if (approvalBlock) return { status: 'pending', reason: `approval_blocked:${approvalBlock}` };
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
    // PG 취소(CANCELED)인데 결제 승인까지 갔던 주문이면 환불로 기록(매출 이력 보존).
    //   webhook·admin 경로와 대칭. expired/payment_failed(결제 미완)는 그대로 둔다.
    if (
      closedStatus === 'canceled' &&
      resolveCancellationTerminalStatus({
        status: input.order.status,
        confirmedAt: order.confirmedAt,
        fulfilledAt: order.fulfilledAt,
      }) === 'refunded'
    ) {
      await markPaymentOrderRefunded({
        orderId: order.orderId,
        reason: `Toss payment status: ${input.payment.status}`,
        source: input.source,
        payment: input.payment,
      });
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
