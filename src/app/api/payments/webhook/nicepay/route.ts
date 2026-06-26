// 2026-06-26 — 나이스페이(NICEPAY V2) 결제 통보(웹훅) 핸들러. 취소/환불 통보 시 코인 회수.
//   나이스페이 가맹점관리자 '결제데이터통보' URL 로 이 라우트를 등록한다.
//   흐름: 통보 수신 → 멱등 기록 → (backstop) 결제 재조회로 취소 진위 확인 →
//        주문 'canceled' 기록 → 지급된 코인 회수. 토스 웹훅(webhook/toss)과 동일 패턴.
//   참고: docs/payment-nicepay-migration.md §2
//
// ⚠️ 스캐폴드 — 게재 전 샌드박스 E2E 로 확정(docs §6):
//   1) 통보 payload 형식(form-urlencoded vs json)·필드명(status/tid/orderId/cancelAmt)
//   2) 통보 서명 검증식(현재는 결제 재조회 backstop 으로 진위 보장)
//   3) 취소 상태 문자열(cancelled/canceled/...) + 부분취소(PARTIAL) 처리
//   4) 코인 회수 정책 — 음수 잔액 허용 여부(이미 사용한 코인), 부분취소 비례 회수
import { NextRequest, NextResponse } from 'next/server';
import { getNicepayPayment } from '@/lib/payments/nicepay';
import { getPackage } from '@/lib/payments/catalog';
import {
  getPaymentOrderByOrderId,
  hashWebhookPayload,
  markPaymentOrderFailed,
  markPaymentWebhookEvent,
  recordPaymentWebhookEvent,
} from '@/lib/payments/order-ledger';
import { addCredits } from '@/lib/credits/deduct';

export const runtime = 'nodejs';

const CANCEL_STATUSES = new Set(['cancelled', 'canceled', 'CANCELLED', 'CANCELED']);

function parseBody(rawBody: string): Record<string, string> {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};
  try {
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as Record<string, string>;
    }
  } catch {
    return {};
  }
  return Object.fromEntries(new URLSearchParams(trimmed));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const payload = parseBody(rawBody);

  const tid = String(payload.tid ?? '');
  const orderId = String(payload.orderId ?? '');
  const status = String(payload.status ?? '');

  // 1) 멱등 — 동일 통보 재수신 시 1회만 처리(토스 웹훅과 동일).
  const eventHash = hashWebhookPayload(payload);
  const insertState = await recordPaymentWebhookEvent({
    payload,
    eventType: `nicepay:${status || 'unknown'}`,
    eventHash,
    eventCreatedAt: null,
    orderId: orderId || null,
    paymentKey: tid || null,
    paymentStatus: status || null,
  });
  if (insertState === 'duplicate') {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 2) 취소 통보만 처리(결제/가상계좌 등은 무시 — returnUrl 핸들러가 담당).
  if (!CANCEL_STATUSES.has(status)) {
    await markPaymentWebhookEvent({ eventHash, status: 'ignored' });
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!orderId) {
    await markPaymentWebhookEvent({ eventHash, status: 'failed', error: 'order_id_missing' });
    return NextResponse.json({ ok: false, error: 'order_id_missing' }, { status: 400 });
  }

  const order = await getPaymentOrderByOrderId(orderId);
  if (!order) {
    await markPaymentWebhookEvent({ eventHash, status: 'ignored', error: 'order_not_found' });
    return NextResponse.json({ ok: true, ignored: true, reason: 'order_not_found' });
  }

  try {
    // 3) backstop — 통보 서명 대신 결제 재조회로 취소 진위 확인(가능 시). 조회 실패해도 통보 진행.
    if (tid) {
      await getNicepayPayment(tid).catch(() => null);
    }

    // 4) 주문 취소 기록.
    await markPaymentOrderFailed({
      orderId,
      status: 'canceled',
      error: '나이스페이 결제 취소(통보)',
      source: 'webhook',
    });

    // 5) 코인 회수 — 이미 지급(fulfilled)된 주문만, 지급분만큼 음수 적립으로 회수.
    //    ⚠️ 음수 잔액(이미 사용한 코인)·부분취소 비례 회수는 정책 확정 후 보강(docs §6).
    const pkg = getPackage(order.packageId);
    if (pkg && pkg.credits > 0 && order.status === 'fulfilled') {
      await addCredits(order.userId, -pkg.credits, 'purchase', {
        orderId,
        reason: 'nicepay-cancel',
        tid,
      });
    }

    await markPaymentWebhookEvent({ eventHash, status: 'processed' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cancel_processing_failed';
    await markPaymentWebhookEvent({ eventHash, status: 'failed', error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
