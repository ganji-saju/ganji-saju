import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/payments/toss';
import {
  getPaymentOrderByOrderId,
  hashWebhookPayload,
  markPaymentWebhookEvent,
  normalizeTossPayment,
  recordPaymentWebhookEvent,
} from '@/lib/payments/order-ledger';
import { settlePaymentOrderFromToss } from '@/lib/payments/reconciliation';

export const runtime = 'nodejs';

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const eventType = readString(payload.eventType) ?? 'UNKNOWN';
  const eventHash = hashWebhookPayload(payload);
  const eventCreatedAt = readString(payload.createdAt);
  const webhookPayment = normalizeTossPayment(payload.data);
  const orderId = webhookPayment?.orderId ?? null;
  const paymentKey = webhookPayment?.paymentKey ?? null;
  const paymentStatus = webhookPayment?.status ?? null;

  const insertState = await recordPaymentWebhookEvent({
    payload,
    eventType,
    eventHash,
    eventCreatedAt,
    orderId,
    paymentKey,
    paymentStatus,
  });

  if (insertState === 'duplicate') {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (eventType !== 'PAYMENT_STATUS_CHANGED') {
    await markPaymentWebhookEvent({ eventHash, status: 'ignored' });
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!webhookPayment || !orderId || !paymentKey) {
    await markPaymentWebhookEvent({
      eventHash,
      status: 'failed',
      error: 'payment_data_missing',
    });
    return NextResponse.json({ ok: false, error: 'payment_data_missing' }, { status: 400 });
  }

  const order = await getPaymentOrderByOrderId(orderId);
  if (!order) {
    await markPaymentWebhookEvent({ eventHash, status: 'ignored', error: 'order_not_found' });
    return NextResponse.json({ ok: true, ignored: true, reason: 'order_not_found' });
  }

  try {
    const verifiedPayment = await getPayment(paymentKey);
    const result = await settlePaymentOrderFromToss({
      order,
      payment: verifiedPayment,
      source: 'webhook',
    });
    await markPaymentWebhookEvent({ eventHash, status: 'processed' });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'webhook_processing_failed';
    await markPaymentWebhookEvent({ eventHash, status: 'failed', error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
