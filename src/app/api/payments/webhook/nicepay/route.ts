// 2026-06-26 — 나이스페이(NICEPAY V2) 결제 통보(웹훅) 핸들러. 취소/환불 통보 시 전 회수.
//   나이스페이 가맹점관리자 '결제데이터통보' URL 로 이 라우트를 등록한다.
//   흐름: 통보 수신 → 멱등 기록(미완 통보는 재처리) → (backstop) 결제 재조회 →
//        전 회수(주문당 1회) → 주문 refunded/canceled 기록 → 이용권 회수(결제키).
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
import type { NicepayPaymentObject } from '@/lib/payments/nicepay';
import { getNicepayPayment } from '@/lib/payments/nicepay';
import { getPackage } from '@/lib/payments/catalog';
import { creditsToRevokeOnCancel } from '@/lib/payments/coin-sunset';
import type { TossPaymentObject } from '@/lib/payments/order-ledger';
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
import { revokeEntitlementsOfPayment } from '@/lib/product-entitlements';

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

// 'OK' 가 아니면 나이스페이가 재전송한다(1분 간격 10회). 미완 통보는 재수신 때 다시 처리되므로 일시 오류의 자동 복구 경로다.
function retryLater() {
  return new NextResponse('RETRY', {
    status: 500,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
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
  const eventHash = hashWebhookPayload(payload);

  // 2026-09-14 — 기록·조회를 포함한 모든 단계를 실패 경로 안에 둔다. 예전엔 주문 조회가 try 밖이라 DB 오류가 500 →
  //   나이스 자동 재전송 10회가 전부 'duplicate → OK' 로 흡수돼 **영구 미처리**였다.
  //   일시 오류는 failed 로 남기고 non-OK 로 응답해 나이스가 재전송하게 한다(1분 간격 10회, docs/nicepay-v2-cancel-facts.md) —
  //   재전송이 자동 복구가 되는 건 ① 미완 통보를 다시 처리하고 ② 재처리가 멱등(전은 주문당 1회, 이용권은 결제키, 원장 전이는 1회)이라서다.
  //   같은 본문으로 결과가 안 바뀌는 판정(비취소·주문 없음·orderId 없음)은 'OK' 로 끝낸다(재전송해도 같다).
  try {
    // 등록 검증(빈/비취소 통보)도 여기서 'OK' 로 응답된다.
    // 1) 멱등 — 끝까지 처리된(processed/ignored) 통보만 흡수한다. received/failed 는 다시 처리한다.
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

    // 3) backstop — 통보 서명 대신 결제 재조회로 취소 진위 확인(가능 시). 조회 실패해도 통보 진행.
    //    2026-08-26 — 조회 결과를 버리지 않고 보관한다. 이 응답의 취소 시각이 환불 귀속일의
    //    정본이다(통보가 재시도로 늦게 도착해도 그날로 밀리지 않게).
    let canceledPayment: NicepayPaymentObject | null = null;
    if (tid) {
      canceledPayment = await getNicepayPayment(tid).catch(() => null);
    }

    // 4) 회수 계획은 **갱신 전** 주문 상태로. 2026-07-10 사고: `pkg.credits > 0` 만 보고 회수해서, credits=0 인 단품
    //      (score-total·today-detail·year-core·lifetime)은 환불 후에도 이용권이 남았다.
    //    2026-09-13 — 이용권은 결제키로 그 결제가 만든 권한 전부(번들 구성품·레거시 전용 권한 포함).
    //    ⚠️ 음수 잔액(이미 사용한 전)·부분취소 비례 회수는 정책 확정 후 보강(docs §6).
    const pkg = getPackage(order.packageId);
    const plan = buildCancellationRevokePlan({
      orderStatus: order.status,
      // 결제가 실제로 지급한 전(멤버십 0 · 대화상담 3 · 전 충전은 카탈로그) — creditsToRevokeOnCancel.
      packageCredits: creditsToRevokeOnCancel(pkg),
      paymentKey: order.paymentKey,
    });

    // 5) 전 회수 — 원장 전이 **전에**, 주문당 1회(revokeCredits 가 orderId 로 중복 차단). 전이 뒤에 두면 전 회수가
    //    일시 오류로 실패했을 때 재처리는 이미 refunded 인 주문을 보고(위 계획) 회수를 건너뛴다. RPC 오류는 던진다 → failed + 재전송.
    if (plan.revokeCredits > 0) {
      const revokeResult = await revokeCredits(order.userId, plan.revokeCredits, 'nicepay-cancel', orderId);
      // 잔액 부족(이미 사용한 전)은 재전송으로 바뀌지 않는다 — 운영 추적용으로 남긴다(수동 보정 대상).
      if (!revokeResult.success) {
        console.error('[nicepay-webhook] 전 회수 실패', { orderId, error: revokeResult.error });
      }
    }

    // 6) 종료 상태 기록. 결제 승인까지 간 주문의 취소는 환불(refunded)이라 매출 이력을
    //    보존한다. 결제 전 취소만 canceled. (과거엔 둘 다 canceled 로 뭉개져 매출이 사라졌다.)
    //    멤버십 원장·GA 환불 훅은 markPaymentOrderRefunded 의 전이 분기라 재처리해도 1회다.
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
        // 재조회 실패 시엔 통보 본문을 넘긴다 — 파싱은 보수적이라 못 읽으면 조용히 now() 폴백.
        payment: canceledPayment ?? (payload as TossPaymentObject),
        // 부분취소는 멤버십 구독을 유지한다(관리자 부분환불과 같은 결과).
        partial: /partial/i.test(status),
      });
    } else {
      await markPaymentOrderFailed({
        orderId,
        status: 'canceled',
        error: '나이스페이 결제 취소(통보)',
        source: 'webhook',
      });
    }

    // 7) 이용권 회수 실패가 취소 통보 처리(원장 전이)를 막지 않게 try — 결제키가 없으면 넓게 지우지 않고 던진다.
    //   2026-09-13 — 실패를 'processed' 로 덮으면 추적이 끊긴다 → 이벤트를 failed 로 남긴다.
    //   2026-09-14 — + non-OK 로 재전송을 받아 다시 처리한다(결제키 회수는 멱등, 전은 위에서 이미 1회).
    let revokeFailure: string | null = null;
    if (plan.revokeGrants) {
      try {
        await revokeEntitlementsOfPayment(order.userId, order.paymentKey, { reason: 'nicepay-cancel', actor: 'webhook' });
      } catch (revokeError) {
        revokeFailure = revokeError instanceof Error ? revokeError.message : String(revokeError);
        console.error('[nicepay-webhook] 이용권 회수 실패', { orderId, error: revokeFailure });
      }
    }

    await markPaymentWebhookEvent(
      revokeFailure ? { eventHash, status: 'failed', error: `revoke_failed: ${revokeFailure}` } : { eventHash, status: 'processed' }
    );
    return revokeFailure ? retryLater() : ok();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cancel_processing_failed';
    console.error('[nicepay-webhook] 처리 실패 — 재전송으로 다시 처리', { orderId, error: message });
    await markPaymentWebhookEvent({ eventHash, status: 'failed', error: message }).catch(() => undefined);
    return retryLater();
  }
}
