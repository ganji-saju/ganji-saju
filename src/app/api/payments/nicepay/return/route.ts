// 2026-06-26 — 나이스페이(NICEPAY V2) 서버승인 returnUrl 핸들러.
//   나이스페이 결제창 인증 완료 → 나이스페이 서버가 이 라우트로 form POST(cross-site).
//   user 세션 쿠키가 오지 않으므로 orderId 로 주문(userId 포함)을 조회한다.
//   흐름: 인증결과 확인 → signature 위변조 검증 → 주문/금액 검증 → 서버 승인 →
//        TossPaymentObject 호환 어댑팅으로 기존 fulfillment 재사용 → 결과 페이지 redirect.
//   참고: docs/payment-nicepay-migration.md §2·§3
//
// ⚠️ 스캐폴드 — 게재 전 샌드박스 E2E 로 콜백 필드명/서명/금액 포맷 확정(docs §6).
import { NextRequest, NextResponse } from 'next/server';
import {
  approveNicepayPayment,
  verifyNicepayAuthSignature,
  type NicepayPaymentObject,
} from '@/lib/payments/nicepay';
import { getPackage } from '@/lib/payments/catalog';
import {
  attachPaymentKeyToOrder,
  getPaymentOrderByOrderId,
  markPaymentOrderConfirmed,
  markPaymentOrderFailed,
  type TossPaymentObject,
} from '@/lib/payments/order-ledger';
import {
  buildAlreadyFulfilledResult,
  fulfillPaymentOrder,
} from '@/lib/payments/fulfillment';

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, req.url), 303);
  const failRedirect = (reason: string) =>
    redirectTo(`/credits/fail?provider=nicepay&reason=${encodeURIComponent(reason)}`);

  if (!form) return failRedirect('결제 응답을 해석하지 못했습니다.');

  const authResultCode = String(form.get('authResultCode') ?? '');
  const tid = String(form.get('tid') ?? '');
  const orderId = String(form.get('orderId') ?? '');
  const amountRaw = String(form.get('amount') ?? '');
  const authToken = String(form.get('authToken') ?? '');
  const signature = String(form.get('signature') ?? '');
  const clientId = (form.get('clientId') as string | null) ?? undefined;
  const amount = Number(amountRaw);

  // 1) 인증 결과(0000=성공)
  if (authResultCode !== '0000') return failRedirect('결제 인증에 실패했습니다.');
  if (!tid || !orderId || !Number.isFinite(amount)) {
    return failRedirect('결제 응답 값이 올바르지 않습니다.');
  }

  // 2) 위변조 검증 (서버승인 핵심) — signature = sha256(authToken+clientId+amount+secretKey)
  if (!verifyNicepayAuthSignature({ authToken, clientId, amount: amountRaw, signature })) {
    return failRedirect('결제 서명 검증에 실패했습니다.');
  }

  // 3) 주문 조회(user 무관) + 금액 정합 (현행 confirm 의 pkg.price 검증과 동일 원칙)
  const order = await getPaymentOrderByOrderId(orderId);
  if (!order) return failRedirect('결제 주문을 찾지 못했습니다.');

  // 이미 지급 완료된 주문이면 승인 재호출 없이 결과 페이지로.
  if (order.status === 'fulfilled' || order.status === 'fulfilling') {
    return redirectTo(`/credits/success?provider=nicepay&orderId=${encodeURIComponent(orderId)}`);
  }

  const pkg = getPackage(order.packageId);
  if (!pkg) return failRedirect('상품 정보를 찾지 못했습니다.');
  if (order.amount !== amount || pkg.price !== amount) {
    return failRedirect('결제 금액이 주문과 일치하지 않습니다.');
  }
  if (order.paymentKey && order.paymentKey !== tid) {
    return failRedirect('이미 다른 결제가 연결된 주문입니다.');
  }

  // 4) 서버 승인 — POST /v1/payments/{tid}
  let nicePayment: NicepayPaymentObject;
  try {
    nicePayment = await approveNicepayPayment(tid, amount);
  } catch (err) {
    await markPaymentOrderFailed({
      orderId,
      status: 'payment_failed',
      error: err instanceof Error ? err.message : '결제 승인 실패',
      source: 'nicepay-return',
    });
    // ⚠️ 승인 호출 타임아웃 시 망취소(net-cancel) 처리 필요(docs §2). 샌드박스 검증 시 추가.
    return failRedirect('결제 승인에 실패했습니다.');
  }

  // 5) TossPaymentObject 호환 어댑팅 — 기존 fulfillment/order-ledger 무변경 재사용.
  //    raw 나이스페이 응답을 보존(...nicePayment)하고 fulfillment 가 보는 필드만 표준화.
  const adapted: TossPaymentObject = {
    ...nicePayment,
    status: 'DONE',
    paymentKey: tid,
    orderId,
    totalAmount: amount,
    amount,
  };

  // 6) confirm + fulfillment (현행 confirm 라우트와 동일 절차)
  try {
    const linked = await attachPaymentKeyToOrder({ order, paymentKey: tid, source: 'nicepay-return' });
    const confirmedOrder = await markPaymentOrderConfirmed({
      orderId,
      payment: adapted,
      source: 'nicepay-return',
    });

    if (confirmedOrder.status !== 'fulfilled' && confirmedOrder.status !== 'fulfilling') {
      await fulfillPaymentOrder({ order: confirmedOrder, payment: adapted, source: 'nicepay-return' });
    } else {
      await buildAlreadyFulfilledResult(confirmedOrder);
    }
    void linked;
  } catch (err) {
    return failRedirect(err instanceof Error ? err.message : '결제 지급 처리에 실패했습니다.');
  }

  // 7) 성공 결과 페이지(이미 승인·지급 완료 → success 페이지는 confirm 재호출 없이 결과만 표시)
  //    충전 코인 수를 함께 넘겨 success 페이지가 '+N 코인'을 정확히 표시.
  return redirectTo(
    `/credits/success?provider=nicepay&orderId=${encodeURIComponent(orderId)}&credits=${pkg.credits}`
  );
}
