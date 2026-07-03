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
import { getPackage, isTasteProductPackage, type PaymentPackage } from '@/lib/payments/catalog';
// 2026-06-27 — buildTasteProductHref 가 못 잡는 단품(money-pattern/work-flow 등)을 '구매상품 보기'
//   위치로 보내 /membership/complete 누수 차단(결제후 위치 == 이미 구매 시 위치 불변식).
import { buildPurchasedProductHref } from '@/lib/payments/product-scope';
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
  type PaymentFulfillmentResult,
} from '@/lib/payments/fulfillment';
// 2026-06-27 — toss(membership/success)와 동일한 결제 후 라우팅 분기를 서버에서 재사용.
import {
  buildCompleteHref,
  buildPremiumResultHref,
  buildTasteProductHref,
} from '@/lib/payments/post-payment-redirect';
// 2026-07-04 admin 지표 감사 — 나이스페이 경로에 confirm_* 퍼널 로그가 전무해
// (Toss 전용 confirm 라우트에만 있었음) 프로덕션 퍼널이 prepare 까지만 기록되던
// 문제 수정. funnel-log 는 내부에서 service 클라이언트로 기록(비차단).
import { logPaymentFunnelEvent, type PaymentFunnelEventInput } from '@/lib/payments/funnel-log';
import { createClient } from '@/lib/supabase/server';

// 결제 후 결과 페이지 결정 — toss(membership/success)의 분기를 서버(nicepay return)에서 재사용.
//   우선순위: ① taste_product(today-detail/궁합/캘린더) ② 사주 premium·lifetime 풀이
//             ③ 전 충전(/credits/success) ④ 그 외 멤버십 완료.
//   fulfillment(신규 지급)이 있으면 그 product/plan 을, 없으면(이미 지급된 재진입) pkg 에서 유도.
function resolveNicepayResultHref(opts: {
  pkg: PaymentPackage;
  order: {
    slug: string | null;
    scope: string | null;
    entrySource: string | null;
    product: string | null;
    plan: string | null;
  };
  orderId: string;
  fulfillment?: PaymentFulfillmentResult | null;
}): string {
  const { pkg, order, orderId, fulfillment } = opts;
  // 2026-06-27 — order.product/plan(주문에 저장된 사용자 실제 선택)을 1순위로. fulfillment/pkg 는 폴백.
  //   bundle 등은 fulfillment.product 가 null 이라 order.product 없이는 결과 라우팅이 샜다.
  const product =
    order.product ?? fulfillment?.product ?? (isTasteProductPackage(pkg) ? pkg.tasteProductId : null);
  const plan = order.plan ?? fulfillment?.plan ?? ('planSlug' in pkg ? pkg.planSlug ?? null : null);

  return (
    buildTasteProductHref(product, order.slug, order.scope, order.entrySource) ??
    buildPremiumResultHref(plan ?? '', order.slug) ??
    // buildTasteProductHref 미커버 단품은 '구매상품 보기' 위치로(불변식). 사주 무관 상품만 아래 폴백.
    (product
      ? buildPurchasedProductHref(product as Parameters<typeof buildPurchasedProductHref>[0], order.slug, {
          from: order.entrySource,
          scope: order.scope,
        })
      : null) ??
    (pkg.kind === 'credits'
      ? `/credits/success?provider=nicepay&orderId=${encodeURIComponent(orderId)}&credits=${pkg.credits}`
      : buildCompleteHref(plan ?? 'premium', order.slug))
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);

  // 퍼널 로그(비차단) — cross-site POST 라 세션 없음; funnel-log 가 service 로 기록.
  const logFunnel = async (input: PaymentFunnelEventInput) => {
    try {
      const client = await createClient();
      await logPaymentFunnelEvent(client, input);
    } catch {
      // best-effort
    }
  };

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, req.url), 303);
  // 결제 실패 시 "다시 결제하기" 가 원래 상품 결제로 돌아가도록 retryPath 를 함께 싣는다.
  //   retryPath 없으면 fail 페이지가 /credits(전충전)로 폴백 — 그게 이 버그의 증상이었다.
  const failRedirect = (reason: string, retryPath?: string | null) => {
    const params = new URLSearchParams({ provider: 'nicepay', reason });
    if (retryPath && retryPath.startsWith('/') && !retryPath.startsWith('//')) {
      params.set('retry', retryPath);
    }
    return redirectTo(`/credits/fail?${params.toString()}`);
  };
  // 주문 metadata.checkoutPath = prepare 가 저장한 원결제 재개 경로(/membership/checkout?... 또는 /credits).
  const readRetryPath = (meta: Record<string, unknown> | null | undefined) => {
    const p = meta?.checkoutPath;
    return typeof p === 'string' ? p : null;
  };
  // order 미조회 단계(인증 실패 등)에서 orderId 로 best-effort 조회 — 재시도 경로와
  // 퍼널 이벤트의 userId/packageId 식별에 함께 사용.
  const lookupOrder = async (id: string) => {
    if (!id) return null;
    try {
      return await getPaymentOrderByOrderId(id);
    } catch {
      return null;
    }
  };

  // 2026-07-04 감사 — 인증 실패(사용자 취소·카드 거절 = 실전 최다 실패)·서명 실패·주문
  // 미조회가 퍼널에 전무해 prepare_ready→confirm 사이 이탈로만 뭉개지던 공백 수정.
  // attempt+failed 쌍으로 기록해 confirmFailRate(=failed/attempt) 분모 왜곡을 막는다.
  const logFailPair = async (opts: {
    reason: string;
    order: Awaited<ReturnType<typeof lookupOrder>>;
    orderId: string;
    amount: number | null;
  }) => {
    const base = {
      userId: opts.order?.userId ?? null,
      packageId: opts.order?.packageId ?? null,
      amount: opts.amount,
      orderId: opts.orderId || null,
      metadata: { provider: 'nicepay' },
    };
    await logFunnel({ stage: 'confirm_attempt', ...base });
    await logFunnel({ stage: 'confirm_failed', ...base, reason: opts.reason });
  };

  if (!form) return failRedirect('결제 응답을 해석하지 못했습니다.');

  const authResultCode = String(form.get('authResultCode') ?? '');
  const tid = String(form.get('tid') ?? '');
  const orderId = String(form.get('orderId') ?? '');
  const amountRaw = String(form.get('amount') ?? '');
  const authToken = String(form.get('authToken') ?? '');
  const signature = String(form.get('signature') ?? '');
  const clientId = (form.get('clientId') as string | null) ?? undefined;
  const amount = Number(amountRaw);

  // 1) 인증 결과(0000=성공) — 카드 거절/사용자 취소 등 가장 흔한 재시도 지점.
  if (authResultCode !== '0000') {
    const failedOrder = await lookupOrder(orderId);
    await logFailPair({
      reason: `auth_failed:${authResultCode || 'unknown'}`.slice(0, 200),
      order: failedOrder,
      orderId,
      amount: Number.isFinite(amount) ? amount : null,
    });
    return failRedirect('결제 인증에 실패했습니다.', readRetryPath(failedOrder?.metadata));
  }
  if (!tid || !orderId || !Number.isFinite(amount)) {
    const failedOrder = await lookupOrder(orderId);
    await logFailPair({
      reason: 'invalid_response',
      order: failedOrder,
      orderId,
      amount: Number.isFinite(amount) ? amount : null,
    });
    return failRedirect('결제 응답 값이 올바르지 않습니다.', readRetryPath(failedOrder?.metadata));
  }

  // 2) 위변조 검증 (서버승인 핵심) — signature = sha256(authToken+clientId+amount+secretKey)
  if (!verifyNicepayAuthSignature({ authToken, clientId, amount: amountRaw, signature })) {
    const failedOrder = await lookupOrder(orderId);
    await logFailPair({ reason: 'signature_invalid', order: failedOrder, orderId, amount });
    return failRedirect('결제 서명 검증에 실패했습니다.', readRetryPath(failedOrder?.metadata));
  }

  // 3) 주문 조회(user 무관) + 금액 정합 (현행 confirm 의 pkg.price 검증과 동일 원칙)
  const order = await getPaymentOrderByOrderId(orderId);
  if (!order) {
    await logFailPair({ reason: 'order_not_found', order: null, orderId, amount });
    return failRedirect('결제 주문을 찾지 못했습니다.');
  }

  const pkg = getPackage(order.packageId);
  if (!pkg) return failRedirect('상품 정보를 찾지 못했습니다.', readRetryPath(order.metadata));

  // 이미 지급 완료된 주문이면 승인 재호출 없이 결과 페이지로(상품별 분기 — 전/사주풀이/소액상품).
  // 재진입은 퍼널에 기록하지 않는다(toss confirm 라우트와 의미 통일).
  if (order.status === 'fulfilled' || order.status === 'fulfilling') {
    return redirectTo(resolveNicepayResultHref({ pkg, order, orderId }));
  }

  // 신규 confirm 시도 — 이후의 모든 실패(confirm_failed)에 대응하는 attempt 를 한 번 기록.
  await logFunnel({
    stage: 'confirm_attempt',
    userId: order.userId,
    packageId: order.packageId,
    amount,
    orderId,
    metadata: { provider: 'nicepay' },
  });

  if (order.amount !== amount || pkg.price !== amount) {
    await logFunnel({
      stage: 'confirm_failed',
      userId: order.userId,
      packageId: order.packageId,
      amount,
      orderId,
      reason: 'amount_mismatch',
    });
    return failRedirect('결제 금액이 주문과 일치하지 않습니다.', readRetryPath(order.metadata));
  }
  if (order.paymentKey && order.paymentKey !== tid) {
    await logFunnel({
      stage: 'confirm_failed',
      userId: order.userId,
      packageId: order.packageId,
      amount,
      orderId,
      reason: 'payment_key_mismatch',
    });
    return failRedirect('이미 다른 결제가 연결된 주문입니다.');
  }

  // 4) 서버 승인 — POST /v1/payments/{tid}
  let nicePayment: NicepayPaymentObject;
  try {
    nicePayment = await approveNicepayPayment(tid, amount);
  } catch (err) {
    // 실패 사유(나이스페이 resultMsg)는 서버 로그·주문 error 에만 보존, 사용자에겐 일반 문구.
    const reason = err instanceof Error && err.message ? err.message : '결제 승인 실패';
    console.error('[nicepay-return] 승인 실패', { orderId, tid, amount, reason });
    await markPaymentOrderFailed({
      orderId,
      status: 'payment_failed',
      error: reason,
      source: 'nicepay-return',
    });
    await logFunnel({
      stage: 'confirm_failed',
      userId: order.userId,
      packageId: order.packageId,
      amount,
      orderId,
      reason: reason.slice(0, 200),
    });
    // ⚠️ 승인 호출 타임아웃 시 망취소(net-cancel) 처리 필요(docs §2). 운영 검증 후 추가.
    return failRedirect('결제 승인에 실패했습니다.', readRetryPath(order.metadata));
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
  let fulfillment: PaymentFulfillmentResult | null = null;
  try {
    const linked = await attachPaymentKeyToOrder({ order, paymentKey: tid, source: 'nicepay-return' });
    const confirmedOrder = await markPaymentOrderConfirmed({
      orderId,
      payment: adapted,
      source: 'nicepay-return',
    });

    if (confirmedOrder.status !== 'fulfilled' && confirmedOrder.status !== 'fulfilling') {
      fulfillment = await fulfillPaymentOrder({ order: confirmedOrder, payment: adapted, source: 'nicepay-return' });
    } else {
      fulfillment = await buildAlreadyFulfilledResult(confirmedOrder);
    }
    void linked;
  } catch (err) {
    await logFunnel({
      stage: 'confirm_failed',
      userId: order.userId,
      packageId: order.packageId,
      amount,
      orderId,
      reason: 'fulfillment_error',
    });
    return failRedirect(err instanceof Error ? err.message : '결제 지급 처리에 실패했습니다.');
  }

  await logFunnel({
    stage: 'confirm_success',
    userId: order.userId,
    packageId: order.packageId,
    amount,
    orderId,
    metadata: { provider: 'nicepay' },
  });

  // 7) 결과 페이지 redirect — 상품별 분기(헬퍼). 이전엔 pkg.kind 무관 항상 /credits/success 로
  //    보내, 사주 풀이(lifetime_report)가 전 페이지로 새어 '오늘운세 무료보기'만 뜨고 풀이를 못
  //    보던 버그(#473~ nicepay 도입 시 membership success 정합 누락). toss 와 동일 흐름으로 통일.
  return redirectTo(resolveNicepayResultHref({ pkg, order, orderId, fulfillment }));
}
