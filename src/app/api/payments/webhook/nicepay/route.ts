// 2026-06-26 — 나이스페이(NICEPAY V2) 결제 통보(웹훅) 핸들러. 취소/환불 통보 시 전 회수.
//   나이스페이 가맹점관리자 '결제데이터통보' URL 로 이 라우트를 등록한다.
//   흐름: 통보 수신 → 멱등 기록 → (backstop) 결제 재조회로 취소 진위 확인 →
//        주문 'canceled' 기록 → 지급된 전 회수. 토스 웹훅(webhook/toss)과 동일 패턴.
//   참고: docs/payment-nicepay-migration.md §2
//
// ⚠️ 나이스페이 규약: 응답 body 는 반드시 plain text 'OK' (status 200). JSON 이면 등록/통보 실패.
//
// ⚠️ 스캐폴드 — 게재 전 샌드박스 E2E 로 확정(docs §6):
//   1) 통보 payload 형식(form-urlencoded vs json)·필드명(status/tid/orderId/cancelAmt)
//   2) 통보 서명 검증식(현재는 결제 재조회 backstop 으로 진위 보장)
//   3) 취소 상태 문자열(cancelled/canceled/...) + 부분취소(PARTIAL) 처리
//   4) 전 회수 정책 — 음수 잔액 허용 여부(이미 사용한 전), 부분취소 비례 회수
import { NextRequest, NextResponse } from 'next/server';
import { getNicepayPayment } from '@/lib/payments/nicepay';
import { getPackage } from '@/lib/payments/catalog';
import {
  getPaymentOrderByOrderId,
  hashWebhookPayload,
  markPaymentOrderFailed,
  markPaymentOrderRefunded,
  markPaymentWebhookEvent,
  recordPaymentWebhookEvent,
} from '@/lib/payments/order-ledger';
import { revokeCredits } from '@/lib/credits/deduct';
import {
  buildCancellationRevokePlan,
  resolveCancellationTerminalStatus,
} from '@/lib/payments/cancellation';
import {
  listProductEntitlementsByOrder,
  revokeProductEntitlement,
} from '@/lib/product-entitlements';

export const runtime = 'nodejs';

const CANCEL_STATUSES = new Set([
  'cancelled',
  'canceled',
  'CANCELLED',
  'CANCELED',
  'partialCancelled', // 부분취소(나이스페이 통보 status). ⚠️ 현재는 전액 회수 — 비례 회수는 후속.
]);

// 나이스페이는 status 200 + body 'OK' 를 성공으로 인정(등록 검증·통보 응답 공통).
function ok() {
  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

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

// 등록 시 나이스페이가 GET 으로 핑을 보낼 수 있어 'OK' 로 응답.
export async function GET() {
  return ok();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const payload = parseBody(rawBody);

  const tid = String(payload.tid ?? '');
  const orderId = String(payload.orderId ?? '');
  const status = String(payload.status ?? '');

  // 등록 검증(빈/비취소 통보)도 여기서 'OK' 로 응답된다.
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
    return ok();
  }

  // 2) 취소 통보만 처리(결제/가상계좌 등은 무시 — returnUrl 핸들러가 담당).
  if (!CANCEL_STATUSES.has(status)) {
    await markPaymentWebhookEvent({ eventHash, status: 'ignored' });
    return ok();
  }

  if (!orderId) {
    await markPaymentWebhookEvent({ eventHash, status: 'failed', error: 'order_id_missing' });
    return ok();
  }

  const order = await getPaymentOrderByOrderId(orderId);
  if (!order) {
    await markPaymentWebhookEvent({ eventHash, status: 'ignored', error: 'order_not_found' });
    return ok();
  }

  try {
    // 3) backstop — 통보 서명 대신 결제 재조회로 취소 진위 확인(가능 시). 조회 실패해도 통보 진행.
    if (tid) {
      await getNicepayPayment(tid).catch(() => null);
    }

    // 4) 종료 상태 기록. 결제 승인까지 간 주문의 취소는 환불(refunded)이라 매출 이력을
    //    보존한다. 결제 전 취소만 canceled. (과거엔 둘 다 canceled 로 뭉개져 매출이 사라졌다.)
    const terminalStatus = resolveCancellationTerminalStatus({
      status: order.status,
      confirmedAt: order.confirmedAt,
      fulfilledAt: order.fulfilledAt,
    });
    if (terminalStatus === 'refunded') {
      await markPaymentOrderRefunded({
        orderId,
        reason: '나이스페이 결제 취소(통보)',
        source: 'webhook',
      });
    } else {
      await markPaymentOrderFailed({
        orderId,
        status: 'canceled',
        error: '나이스페이 결제 취소(통보)',
        source: 'webhook',
      });
    }

    // 5) 지급분 회수 — 전(코인) + 상품 이용권. 회수는 지급과 대칭이어야 한다.
    //    2026-07-10 사고: 여기서 `pkg.credits > 0` 만 보고 회수해서, credits=0 인 단품
    //      (score-total·today-detail·year-core·lifetime)은 환불 후에도 이용권이 남았다.
    //      실제 지급 기록(order_id 로 열거)에 맞춰 회수한다 — 번들이면 구성품 전부.
    //    ⚠️ 음수 잔액(이미 사용한 전)·부분취소 비례 회수는 정책 확정 후 보강(docs §6).
    const pkg = getPackage(order.packageId);
    const plan = buildCancellationRevokePlan({
      orderStatus: order.status,
      packageCredits: pkg?.credits ?? 0,
      entitlements: await listProductEntitlementsByOrder(orderId),
    });

    if (plan.revokeCredits > 0) {
      const revokeResult = await revokeCredits(order.userId, plan.revokeCredits, 'nicepay-cancel');
      // 회수 실패(잔액 부족 등)는 운영 추적용으로 남긴다 — 수동 보정 대상.
      if (!revokeResult.success) {
        console.error('[nicepay-webhook] 전 회수 실패', { orderId, error: revokeResult.error });
      }
    }

    // 이용권 회수 실패가 취소 통보 처리를 막지 않게 개별 try — 남은 행은 수동 보정 대상.
    for (const entitlement of plan.revokeEntitlements) {
      try {
        await revokeProductEntitlement(
          entitlement.userId,
          entitlement.productId as Parameters<typeof revokeProductEntitlement>[1],
          entitlement.scopeKey,
          { reason: 'nicepay-cancel', actor: 'webhook', paymentKey: order.paymentKey }
        );
      } catch (revokeError) {
        console.error('[nicepay-webhook] 이용권 회수 실패', {
          orderId,
          productId: entitlement.productId,
          error: revokeError instanceof Error ? revokeError.message : String(revokeError),
        });
      }
    }

    await markPaymentWebhookEvent({ eventHash, status: 'processed' });
    return ok();
  } catch (err) {
    // 처리 실패해도 'OK' 로 응답하고 failed 로 기록(수동 보정 대상). 통보 재수신은 멱등으로 흡수.
    const message = err instanceof Error ? err.message : 'cancel_processing_failed';
    await markPaymentWebhookEvent({ eventHash, status: 'failed', error: message });
    return ok();
  }
}
