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
import { verifyTossWebhookSignature } from '@/lib/payments/webhook-signature';

export const runtime = 'nodejs';

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function POST(req: NextRequest) {
  // HMAC 검증을 위해 원본 body 를 raw text 로 읽는다(JSON.parse 전 정확한 바이트열 필요).
  const rawBody = await req.text();

  // 2026-06-21 보안 — Toss 웹훅 서명 검증(정식). 보안 키가 설정돼 있고 서명 헤더가
  //   존재할 때만 강제한다. 서명 없는 웹훅 타입(PAYMENT_STATUS_CHANGED 등)은 헤더 부재로
  //   이 블록을 건너뛰고, 아래의 Toss API 재조회(getPayment)로 진위를 보장한다(backstop).
  const webhookSecurityKey = process.env.TOSS_WEBHOOK_SECURITY_KEY?.trim();
  const signatureHeader = req.headers.get('tosspayments-webhook-signature');
  if (webhookSecurityKey && signatureHeader) {
    const valid = verifyTossWebhookSignature({
      rawBody,
      signatureHeader,
      transmissionTime: req.headers.get('tosspayments-webhook-transmission-time'),
      securityKey: webhookSecurityKey,
    });
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
    }
  }

  let payload: Record<string, unknown> | null;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }
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
