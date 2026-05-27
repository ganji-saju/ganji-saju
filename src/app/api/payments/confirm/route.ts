import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { confirmPayment } from '@/lib/payments/toss';
import { validatePaymentConfirmationPayload } from '@/lib/payments/confirmation';
import {
  attachPaymentKeyToOrder,
  getPaymentOrderForUser,
  markPaymentOrderConfirmed,
  markPaymentOrderFailed,
} from '@/lib/payments/order-ledger';
import {
  buildAlreadyFulfilledResult,
  fulfillPaymentOrder,
} from '@/lib/payments/fulfillment';
// 2026-05-16 PR (B1) — 결제 funnel 단계 기록.
import { logPaymentFunnelEvent } from '@/lib/payments/funnel-log';

export async function POST(req: NextRequest) {
  const validation = validatePaymentConfirmationPayload(await req.json().catch(() => null));

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { paymentKey, orderId, amount: parsedAmount, packageId, pkg } = validation.input;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // B1 funnel — confirm 진입.
  await logPaymentFunnelEvent(supabase, {
    stage: 'confirm_attempt',
    userId: user.id,
    packageId: pkg.id,
    amount: parsedAmount,
    orderId,
  });

  let order = await getPaymentOrderForUser(orderId, user.id);
  if (!order) {
    await logPaymentFunnelEvent(supabase, {
      stage: 'confirm_failed',
      userId: user.id,
      packageId: pkg.id,
      amount: parsedAmount,
      orderId,
      reason: 'order_not_found',
    });
    return NextResponse.json({ error: '결제 주문을 찾지 못했습니다.' }, { status: 400 });
  }

  if (order.status === 'fulfilled' || order.status === 'fulfilling') {
    const result = await buildAlreadyFulfilledResult(order);
    return NextResponse.json(result);
  }

  if (order.packageId !== packageId || order.amount !== parsedAmount) {
    await logPaymentFunnelEvent(supabase, {
      stage: 'confirm_failed',
      userId: user.id,
      packageId: pkg.id,
      amount: parsedAmount,
      orderId,
      reason: 'payload_mismatch',
      metadata: { orderPackageId: order.packageId, orderAmount: order.amount },
    });
    return NextResponse.json({ error: '결제 정보가 내부 주문과 일치하지 않습니다.' }, { status: 400 });
  }

  if (order.paymentKey && order.paymentKey !== paymentKey) {
    await logPaymentFunnelEvent(supabase, {
      stage: 'confirm_failed',
      userId: user.id,
      packageId: pkg.id,
      amount: parsedAmount,
      orderId,
      reason: 'payment_key_mismatch',
    });
    return NextResponse.json({ error: '이미 다른 결제 키가 연결된 주문입니다.' }, { status: 400 });
  }

  order = await attachPaymentKeyToOrder({ order, paymentKey, source: 'confirm' });

  // 토스페이먼츠 결제 승인
  const payment =
    order.status === 'confirmed' && order.tossPayment
      ? order.tossPayment
      : await confirmPayment(paymentKey, orderId, parsedAmount).catch(async (err) => {
          await markPaymentOrderFailed({
            orderId,
            status: 'payment_failed',
            error: err instanceof Error ? err.message : '결제 승인 실패',
            source: 'confirm',
          });
          return NextResponse.json(
            { error: err instanceof Error ? err.message : '결제 승인 실패' },
            { status: 400 }
          );
        });

  if (payment instanceof NextResponse) {
    await logPaymentFunnelEvent(supabase, {
      stage: 'confirm_failed',
      userId: user.id,
      packageId: pkg.id,
      amount: parsedAmount,
      orderId,
      reason: 'toss_confirm_error',
    });
    return payment;
  }

  const fulfillment = await (async () => {
    try {
      const confirmedOrder = await markPaymentOrderConfirmed({
        orderId,
        payment,
        source: 'confirm',
      });

      if (confirmedOrder.status === 'fulfilled' || confirmedOrder.status === 'fulfilling') {
        return await buildAlreadyFulfilledResult(confirmedOrder);
      }

      return await fulfillPaymentOrder({
        order: confirmedOrder,
        payment,
        source: 'confirm',
      });
    } catch (err) {
      await logPaymentFunnelEvent(supabase, {
        stage: 'confirm_failed',
        userId: user.id,
        packageId: pkg.id,
        amount: parsedAmount,
        orderId,
        reason: 'fulfillment_error',
      });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : '결제 지급 처리 실패' },
        { status: 500 }
      );
    }
  })();

  if (fulfillment instanceof NextResponse) {
    return fulfillment;
  }

  // B1 funnel — confirm 성공.
  await logPaymentFunnelEvent(supabase, {
    stage: 'confirm_success',
    userId: user.id,
    packageId: pkg.id,
    amount: parsedAmount,
    orderId,
    metadata: { credits: pkg.credits, kind: pkg.kind },
  });

  return NextResponse.json({
    ...fulfillment,
  });
}
