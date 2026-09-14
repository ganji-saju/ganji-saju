// 2026-06-26 — 나이스페이(NICEPAY V2) 결제 통보(웹훅) 핸들러. 취소/환불 통보 시 전 회수.
//   나이스페이 가맹점관리자 '결제데이터통보' URL 로 이 라우트를 등록한다.
//   흐름: 통보 수신 → 멱등 기록(미완 통보는 재처리) → 위조 가드(서명 · tid 로 주문 · 나이스 재조회 대조) →
//        전액: 전 회수(주문당 1회) → 주문 refunded/canceled 기록 → 이용권 회수(결제키)
//        일부(partialCancelled): 주문은 그대로 · 멤버십이면 기간 줄이기(연산 4, 취소 거래 단위 1회) · 그 외 이용권 유지.
//   사실 정본: docs/nicepay-v2-cancel-facts.md (status enum · cancels[] · signature 식 · 재전송 규약).
//
// ⚠️ 나이스페이 규약: 응답 body 는 반드시 plain text 'OK' (status 200). JSON 이면 등록/통보 실패.
import { NextRequest, NextResponse } from 'next/server';
import type { NicepayPaymentObject } from '@/lib/payments/nicepay';
import {
  getNicepayPayment,
  isCancelOrderIdOf,
  pickNicepayCancel,
  verifyNicepayWebhookSignature,
} from '@/lib/payments/nicepay';
import { getPackage } from '@/lib/payments/catalog';
import { creditsToRevokeOnCancel } from '@/lib/payments/coin-sunset';
import type { PaymentOrder, TossPaymentObject } from '@/lib/payments/order-ledger';
import {
  applyPartialRefund,
  getPaymentOrderByOrderId,
  getPaymentOrderByPaymentKey,
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
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';

export const runtime = 'nodejs';

// 명세 enum 그대로(hook.md·cancel.md·status-transaction.md) — `canceled`·대문자는 명세에 없다.
const CANCEL_STATUSES = new Set(['cancelled', 'partialCancelled']);

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
  //   같은 본문으로 결과가 안 바뀌는 판정(비취소·주문 없음·tid 없음·검증 불일치)은 'OK' 로 끝낸다(재전송해도 같다).
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

    // 3) 위조 가드(2026-09-14 사용자 결정) — 통보 본문은 누구나 보낼 수 있고 서명은 status·orderId·cancels 를 덮지 않는다.
    //    주문은 tid(= 결제키)로 찾고, 나이스에 직접 되물어(재조회) 진짜 취소일 때만 처리한다. 불일치는 ignored + 사유 + 운영 메일 —
    //    진짜 취소를 잘못 거부해도 사람이 바로 알게. 재조회 일시 오류는 던진다 → failed + non-OK(재전송으로 복구).
    const reject = async (reason: string, suspect: PaymentOrder | null = null) => {
      await markPaymentWebhookEvent({ eventHash, status: 'ignored', error: `forgery_guard:${reason}` });
      console.error('[nicepay-webhook] 취소 통보 검증 불일치 — 처리 안 함', { reason, tid, orderId, status });
      if (process.env.VERCEL_ENV === 'production') {
        await sendOpsAlertEmail({
          subject: '[나이스 통보] 취소 통보 검증 불일치 — 처리 안 함',
          lines: [
            `사유 ${reason} · status ${status}`,
            `통보 tid ${tid || '(없음)'} · 통보 orderId ${orderId || '(없음)'}`,
            suspect ? `주문 ${suspect.orderId} · 사용자 ${suspect.userId} · 결제키 ${suspect.paymentKey ?? '(없음)'}` : '주문 없음',
            '진짜 취소라면 나이스 콘솔에서 그 거래를 확인하고 관리자 화면에서 환불 상태를 맞추세요(원문은 payment_webhook_events).',
          ],
          url: '/admin/users',
        }).catch(() => undefined);
      }
      return ok();
    };

    if (!tid) {
      await markPaymentWebhookEvent({ eventHash, status: 'failed', error: 'tid_missing' });
      return ok();
    }
    // ③ 서명 — 오면 대조(없으면 선택 필드라 통과, 재조회가 진위를 본다).
    if (typeof payload.signature === 'string' && payload.signature) {
      const signed = verifyNicepayWebhookSignature({ tid: payload.tid, amount: payload.amount, ediDate: payload.ediDate, signature: payload.signature });
      if (!signed) return reject('signature_mismatch');
    }
    // ① tid 우선 — orderId 는 보조. tid 로 못 찾았는데 orderId 의 주문이 있으면 그 주문의 결제키와 어긋난 통보다.
    const order = await getPaymentOrderByPaymentKey(tid);
    if (!order) {
      const byOrderId = orderId ? await getPaymentOrderByOrderId(orderId) : null;
      if (byOrderId) return reject('tid_mismatch', byOrderId);
      await markPaymentWebhookEvent({ eventHash, status: 'ignored', error: 'order_not_found' });
      return ok();
    }
    // API 취소 통보의 orderId 는 원주문일 가능성이 높지만 미실측 — 우리가 만든 취소 요청 번호(cxl…_원주문)도 같은 주문으로 본다.
    if (orderId && orderId !== order.orderId && !isCancelOrderIdOf(orderId, order.orderId)) return reject('order_id_mismatch', order);

    // ② 재조회 — status 가 통보와 맞는 취소 상태 · orderId·amount 가 주문과 일치할 때만. 일부 통보 뒤 잔여 취소가 이미 됐으면 재조회는 cancelled.
    let payment: NicepayPaymentObject;
    try {
      payment = await getNicepayPayment(tid); // = order.paymentKey (tid 로 찾은 주문)
    } catch (lookupError) {
      const code = (lookupError as { resultCode?: unknown }).resultCode;
      // PG 가 결과 코드로 거절했다(거래 없음 등) = 재전송해도 같다. 코드 없는 실패(네트워크·5xx)는 일시 오류 → 재전송.
      if (typeof code === 'string') return reject(`lookup_rejected:${code}`, order);
      throw lookupError;
    }
    const lookedUp = String(payment.status ?? '');
    const statusMatches = status === 'cancelled' ? lookedUp === 'cancelled' : CANCEL_STATUSES.has(lookedUp);
    if (!statusMatches) return reject(`lookup_status:${lookedUp || 'none'}`, order);
    if (payment.orderId !== order.orderId || Number(payment.amount) !== order.amount) return reject('lookup_order_mismatch', order);

    // 4) 일부 취소 — 전액 처리 금지(주문 refunded 표기·전/이용권 회수·GA 전액 환불 없음). 금액·거래는 재조회의 cancels[] 가 정본.
    if (status === 'partialCancelled') {
      const cancel = pickNicepayCancel(payment, pickNicepayCancel(payload)?.tid);
      if (!cancel) return reject('cancel_not_in_lookup', order);
      const outcome = await applyPartialRefund({
        orderId: order.orderId,
        cancelTid: cancel.tid,
        amount: cancel.amount,
        reason: '나이스페이 일부 취소(통보)',
        source: 'webhook',
        payment: payment as TossPaymentObject,
      });
      await markPaymentWebhookEvent({ eventHash, status: 'processed', error: `partial:${outcome}` });
      return ok();
    }

    // 5) 전액 취소 — 회수 계획은 **갱신 전** 주문 상태로. 2026-07-10 사고: `pkg.credits > 0` 만 보고 회수해서, credits=0 인 단품
    //      (score-total·today-detail·year-core·lifetime)은 환불 후에도 이용권이 남았다.
    //    2026-09-13 — 이용권은 결제키로 그 결제가 만든 권한 전부(번들 구성품·레거시 전용 권한 포함).
    //    ⚠️ 음수 잔액(이미 사용한 전)은 정책 확정 후 보강(docs §6).
    const pkg = getPackage(order.packageId);
    const plan = buildCancellationRevokePlan({
      orderStatus: order.status,
      // 결제가 실제로 지급한 전(멤버십 0 · 대화상담 3 · 전 충전은 카탈로그) — creditsToRevokeOnCancel.
      packageCredits: creditsToRevokeOnCancel(pkg),
      paymentKey: order.paymentKey,
    });

    // 6) 전 회수 — 원장 전이 **전에**, 주문당 1회(revokeCredits 가 orderId 로 중복 차단). 전이 뒤에 두면 전 회수가
    //    일시 오류로 실패했을 때 재처리는 이미 refunded 인 주문을 보고(위 계획) 회수를 건너뛴다. RPC 오류는 던진다 → failed + 재전송.
    if (plan.revokeCredits > 0) {
      const revokeResult = await revokeCredits(order.userId, plan.revokeCredits, 'nicepay-cancel', order.orderId);
      // 잔액 부족(이미 사용한 전)은 재전송으로 바뀌지 않는다 — 운영 추적용으로 남긴다(수동 보정 대상).
      if (!revokeResult.success) {
        console.error('[nicepay-webhook] 전 회수 실패', { orderId: order.orderId, error: revokeResult.error });
      }
    }

    // 7) 종료 상태 기록. 결제 승인까지 간 주문의 취소는 환불(refunded)이라 매출 이력을
    //    보존한다. 결제 전 취소만 canceled. (과거엔 둘 다 canceled 로 뭉개져 매출이 사라졌다.)
    //    멤버십 원장·GA 환불 훅은 markPaymentOrderRefunded 의 전이 분기라 재처리해도 1회다.
    const terminalStatus = resolveCancellationTerminalStatus({
      status: order.status,
      confirmedAt: order.confirmedAt,
      fulfilledAt: order.fulfilledAt,
    });
    if (terminalStatus === 'refunded') {
      await markPaymentOrderRefunded({
        orderId: order.orderId,
        reason: '나이스페이 결제 취소(통보)',
        source: 'webhook',
        // 2026-08-26 — 재조회 응답의 취소 시각이 환불 귀속일의 정본(통보가 재전송으로 늦게 와도 그날로 밀리지 않게).
        payment: payment as TossPaymentObject,
      });
    } else {
      await markPaymentOrderFailed({
        orderId: order.orderId,
        status: 'canceled',
        error: '나이스페이 결제 취소(통보)',
        source: 'webhook',
      });
    }

    // 8) 이용권 회수 실패가 취소 통보 처리(원장 전이)를 막지 않게 try — 결제키가 없으면 넓게 지우지 않고 던진다.
    //   2026-09-13 — 실패를 'processed' 로 덮으면 추적이 끊긴다 → 이벤트를 failed 로 남긴다.
    //   2026-09-14 — + non-OK 로 재전송을 받아 다시 처리한다(결제키 회수는 멱등, 전은 위에서 이미 1회).
    let revokeFailure: string | null = null;
    if (plan.revokeGrants) {
      try {
        await revokeEntitlementsOfPayment(order.userId, order.paymentKey, { reason: 'nicepay-cancel', actor: 'webhook' });
      } catch (revokeError) {
        revokeFailure = revokeError instanceof Error ? revokeError.message : String(revokeError);
        console.error('[nicepay-webhook] 이용권 회수 실패', { orderId: order.orderId, error: revokeFailure });
      }
    }

    // 미완 재처리인데 주문이 이미 refunded 였다 = 멤버십 후처리(전이 분기 1회)는 이번에 돌지 않았다. 첫 시도가 전이를 커밋한 뒤
    //   훅 도중 죽었거나 응답을 잃었을 수 있어 processed 로 덮되 흔적을 남긴다(membership_periods 무효 여부 수동 확인).
    const note =
      insertState === 'unfinished' && order.status === 'refunded' && pkg?.kind === 'subscription'
        ? 'reprocessed_after_transition — 멤버십 후처리 확인'
        : null;
    await markPaymentWebhookEvent(
      revokeFailure ? { eventHash, status: 'failed', error: `revoke_failed: ${revokeFailure}` } : { eventHash, status: 'processed', error: note }
    );
    return revokeFailure ? retryLater() : ok();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cancel_processing_failed';
    console.error('[nicepay-webhook] 처리 실패 — 재전송으로 다시 처리', { orderId, error: message });
    await markPaymentWebhookEvent({ eventHash, status: 'failed', error: message }).catch(() => undefined);
    return retryLater();
  }
}
