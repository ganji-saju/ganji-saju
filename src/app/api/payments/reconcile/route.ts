import { NextRequest, NextResponse } from 'next/server';
import { getPayment, getPaymentByOrderId } from '@/lib/payments/toss';
import {
  listPaymentOrdersForReconciliation,
  markPaymentOrderFailed,
  touchPaymentOrderReconciled,
  type PaymentOrder,
} from '@/lib/payments/order-ledger';
import { settlePaymentOrderFromToss } from '@/lib/payments/reconciliation';

export const runtime = 'nodejs';

function isAuthorized(req: NextRequest) {
  const secret = process.env.PAYMENT_RECONCILIATION_SECRET ?? process.env.CRON_SECRET ?? null;
  if (!secret) return false;

  const authorization = req.headers.get('authorization');
  const headerSecret = req.headers.get('x-payment-reconciliation-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

async function reconcileOne(order: PaymentOrder) {
  await touchPaymentOrderReconciled(order.orderId);

  try {
    const payment = order.paymentKey
      ? await getPayment(order.paymentKey)
      : await getPaymentByOrderId(order.orderId);
    return settlePaymentOrderFromToss({
      order,
      payment,
      source: 'reconciliation',
    });
  } catch (error) {
    const expired = order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now();
    if (expired) {
      await markPaymentOrderFailed({
        orderId: order.orderId,
        status: 'expired',
        error: error instanceof Error ? error.message : 'payment_order_expired',
        source: 'reconciliation',
      });
      return { status: 'closed' as const, reason: 'expired' };
    }

    return {
      status: 'pending' as const,
      reason: error instanceof Error ? error.message : 'payment_lookup_failed',
    };
  }
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 401 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const parsedLimit = limitParam ? Number(limitParam) : 20;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20;
  const orders = await listPaymentOrdersForReconciliation(limit);
  const results = [];

  for (const order of orders) {
    const result = await reconcileOne(order);
    results.push({ orderId: order.orderId, result });
  }

  return NextResponse.json({
    ok: true,
    checked: orders.length,
    results,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
