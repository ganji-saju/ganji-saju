import { NextRequest, NextResponse } from 'next/server';
import {
  getPackage,
  isBundlePackage,
  isSubscriptionPackage,
  isTasteProductPackage,
} from '@/lib/payments/catalog';
import { areAllBundleComponentsOwned } from '@/lib/payments/bundle';
import { getPaymentProvider } from '@/lib/payments/provider';
import {
  buildPurchasedProductHref,
  resolvePaymentProductScope,
  type PaymentProductScope,
} from '@/lib/payments/product-scope';
import {
  getTasteProductEntitlement,
  hasTodayDetailEntitlementForDay,
} from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import {
  getKoreaAccessDay,
  hasDetailReportAccess,
  hasTodayFortunePremiumAccess,
  hasTodayFortunePremiumAccessByReading,
} from '@/lib/credits/detail-report-access';
import { createClient } from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';
// 2026-05-16 PR (B1) — funnel 단계 기록. admin/payment-funnel 대시보드 데이터 source.
import { logPaymentFunnelEvent } from '@/lib/payments/funnel-log';
// 2026-05-18 Phase 3-C-1 — 결제 전 동의 검증 + DB 기록.
import { findMissingConsents, recordConsentsForPayment } from '@/lib/payments/consent';
import { POLICY_KINDS, type PolicyKind } from '@/shared/policies/types';
import {
  createPaymentOrder,
  updatePaymentOrderPolicyVersions,
} from '@/lib/payments/order-ledger';
import { isCreditPackage } from '@/lib/payments/coin-sunset';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';

function readString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

function buildCheckoutPath(input: {
  packageId: string;
  product: string;
  plan: string;
  slug: string | null;
  scope: string | null;
  from: string | null;
}) {
  if (!input.product && !input.plan) {
    const params = new URLSearchParams();
    if (input.from) params.set('from', input.from);
    const query = params.toString();
    return query ? `/credits?${query}` : '/credits';
  }

  const params = new URLSearchParams();
  if (input.product) params.set('product', input.product);
  else if (input.plan) params.set('plan', input.plan);
  if (input.slug) params.set('slug', input.slug);
  if (input.scope) params.set('scope', input.scope);
  if (input.from) params.set('from', input.from);

  const query = params.toString();
  return query ? `/membership/checkout?${query}` : '/membership/checkout';
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: '결제 준비 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const packageId = readString(payload, 'packageId');
  const product = readString(payload, 'product');
  const plan = readString(payload, 'plan');
  const slug = readString(payload, 'slug') || null;
  const scope = readString(payload, 'scope') || null;
  const from = readString(payload, 'from') || null;
  const paymentMethodCode = readString(payload, 'paymentMethod') || null;
  const pkg = getPackage(packageId);

  if (!pkg) {
    return NextResponse.json({ error: '결제 상품을 찾지 못했습니다.' }, { status: 400 });
  }

  // 2026-06-30 전 충전 전면 중단(coin-sunset Phase 1). 전팩 결제 요청 자체를 거부.
  if (isCreditPackage(pkg)) {
    // 2026-07-04 감사 — 잔존 유입(구 링크·캐시 UI) 관측용. 410이 prepare_attempt(110행)
    // 보다 앞이라 이 시도들이 퍼널에 전혀 안 잡히던 문제.
    // attempt+blocked 쌍으로 기록 — blocked ⊆ attempt 불변식 유지(blockRate>100% 모순 방지).
    const sunsetClient = await createClient();
    await logPaymentFunnelEvent(sunsetClient, {
      stage: 'prepare_attempt',
      packageId,
      amount: pkg.price ?? null,
      metadata: { product, plan, slug, scope, from },
    });
    await logPaymentFunnelEvent(sunsetClient, {
      stage: 'prepare_blocked',
      packageId,
      amount: pkg.price ?? null,
      reason: 'credit_package_sunset',
    });
    return NextResponse.json(
      { ok: false, error: '전 충전은 현재 제공하지 않습니다.' },
      { status: 410 }
    );
  }

  if ((pkg.kind === 'lifetime_report' || pkg.requiresSlug) && !slug) {
    return NextResponse.json(
      { error: '이 상품은 먼저 풀이 결과를 만든 뒤 결제할 수 있습니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // B1 funnel — 모든 prepare 호출의 진입 시점을 기록.
  await logPaymentFunnelEvent(supabase, {
    stage: 'prepare_attempt',
    userId: user?.id ?? null,
    packageId,
    amount: pkg.price ?? null,
    metadata: { product, plan, slug, scope, from },
  });

  const checkoutPath = buildCheckoutPath({ packageId, product, plan, slug, scope, from });
  if (!user) {
    await logPaymentFunnelEvent(supabase, {
      stage: 'prepare_blocked',
      userId: null,
      packageId,
      reason: 'unauthenticated',
    });
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        loginHref: `/login?next=${encodeURIComponent(checkoutPath)}`,
      },
      { status: 401 }
    );
  }

  if (isSubscriptionPackage(pkg)) {
    const subscription = await getManagedSubscription(user.id);
    if (subscription?.status === 'active' && subscription.plan === pkg.subscriptionPlan) {
      await logPaymentFunnelEvent(supabase, {
        stage: 'prepare_blocked',
        userId: user.id,
        packageId,
        reason: 'active_subscription',
      });
      return NextResponse.json({
        ok: true,
        authenticated: true,
        alreadyPurchased: true,
        redirectHref: '/my/billing',
        reason: 'active_subscription',
      });
    }
  }

  // 묶음(bundle)은 1결제=N권한이라 단일 paymentScope 가 없다(resolvePaymentProductScope=null).
  // 구성품을 전부 보유한 경우에만 중복 차단하고, 미보유면 아래 동의 검증을 거쳐 결제 진행한다
  // (보유분은 confirm 의 grant 가 멱등 skip). b1 의 단건 중복 차단과 동일 취지.
  let paymentScope: PaymentProductScope | null = null;

  if (isBundlePackage(pkg)) {
    const allOwned = await areAllBundleComponentsOwned(pkg, slug, {
      resolveScope: (input) => resolvePaymentProductScope(input),
      hasEntitlement: (productId, scopeKey) =>
        getTasteProductEntitlement(user.id, productId, scopeKey).then(Boolean),
    });
    if (allOwned) {
      await logPaymentFunnelEvent(supabase, {
        stage: 'prepare_blocked',
        userId: user.id,
        packageId,
        reason: 'existing_entitlement',
      });
      return NextResponse.json({
        ok: true,
        authenticated: true,
        alreadyPurchased: true,
        scopeKey: null,
        redirectHref: '/my/results',
        reason: 'existing_entitlement',
      });
    }
  } else {
    paymentScope = await resolvePaymentProductScope({ pkg, slug, scope });
    if (paymentScope) {
      // 2026-06-05 — today-detail 은 일일 상품. 재구매 차단(alreadyPurchased)도 오늘(KST)
      //   접근분만 봐야 한다. 영구 entitlement/coin 조회로 차단하면 "어제 결제 → 오늘 재구매
      //   차단 → detail 은 오늘 접근 없음" 루프가 생긴다(unlock/detail 게이트와 정합).
      const todayKey = getKoreaAccessDay();
      const isTodayDetail =
        isTasteProductPackage(pkg) && pkg.tasteProductId === 'today-detail';

      const entitlement = isTodayDetail
        ? await hasTodayDetailEntitlementForDay(user.id, todayKey)
        : isTasteProductPackage(pkg)
          ? await getTasteProductEntitlement(user.id, pkg.tasteProductId, paymentScope.scopeKey)
          : await getLifetimeReportEntitlement(
              user.id,
              paymentScope.readingKey ?? paymentScope.slug ?? '',
              paymentScope.slug ? [paymentScope.slug] : []
            );
      // today-detail 전 해제 중복 차단도 오늘(KST) unlock 만 확인(slug / readingKey 양쪽).
      const coinUnlockedTodayDetail =
        isTodayDetail && paymentScope.slug
          ? (await hasTodayFortunePremiumAccess(user.id, paymentScope.slug, todayKey)) ||
            (paymentScope.readingKey
              ? (await hasTodayFortunePremiumAccessByReading(
                  user.id,
                  paymentScope.readingKey,
                  todayKey
                )) ||
                (await hasDetailReportAccess(user.id, paymentScope.readingKey, todayKey))
              : false)
          : false;

      if (entitlement || coinUnlockedTodayDetail) {
        await logPaymentFunnelEvent(supabase, {
          stage: 'prepare_blocked',
          userId: user.id,
          packageId,
          reason: entitlement ? 'existing_entitlement' : 'existing_credit_unlock',
        });
        return NextResponse.json({
          ok: true,
          authenticated: true,
          alreadyPurchased: true,
          scopeKey: paymentScope.scopeKey,
          redirectHref: buildPurchasedProductHref(paymentScope.productId, slug, { from, scope }),
          reason: entitlement ? 'existing_entitlement' : 'existing_credit_unlock',
        });
      }
    }
  }

  // 2026-05-27: 모든 prepare 호출에서 동의 검증을 강제한다. /credits 도 이
  // 경로를 타므로 coin 정책 동의와 funnel prepare 로그가 같은 방식으로 남는다.
  const acceptedKindsRaw = Array.isArray(payload.acceptedKinds) ? payload.acceptedKinds : [];
  const acceptedKinds: PolicyKind[] = acceptedKindsRaw.filter(
    (k): k is PolicyKind =>
      typeof k === 'string' && (POLICY_KINDS as readonly string[]).includes(k)
  );

  const missing = findMissingConsents(pkg, acceptedKinds);
  if (missing.length > 0) {
    await logPaymentFunnelEvent(supabase, {
      stage: 'prepare_blocked',
      userId: user.id,
      packageId,
      reason: 'consent_missing',
      metadata: { missing },
    });
    return NextResponse.json(
      {
        ok: false,
        authenticated: true,
        error: '필수 동의 항목이 누락되었습니다.',
        missingConsents: missing,
      },
      { status: 400 }
    );
  }

  // 2026-07-07 — 주문 금액을 리졸버로 스냅샷(카탈로그 기본가 위 DB 오버라이드).
  //   이후 confirm/return 은 이 order.amount 를 authoritative 검증한다.
  const resolvedAmount = await resolvePackagePrice(pkg.id);
  const order = await createPaymentOrder({
    userId: user.id,
    pkg,
    amount: resolvedAmount,
    slug,
    scope,
    product,
    plan,
    entrySource: from,
    paymentMethodCode,
    acceptedKinds,
    recordedPolicyVersionIds: [],
    // 2026-06-26 — 환불 시 PG 분기용 provider 저장(admin refund 가 toss/nicepay 취소 선택).
    metadata: { checkoutPath, provider: getPaymentProvider() },
  });

  // 동의 기록 — 활성 PolicyVersion fetch 후 user_policy_consents insert.
  // 실패해도 결제 자체는 진행 (graceful — 정책 본문 admin 입력 전이면 skip).
  let recordedPolicyVersionIds: string[] = [];
  let consentRecordError = false;
  try {
    recordedPolicyVersionIds = await recordConsentsForPayment({
      userId: user.id,
      pkg,
      acceptedKinds,
      orderId: order.orderId,
      userAgent: req.headers.get('user-agent') ?? null,
      ip:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null,
    });
    await updatePaymentOrderPolicyVersions(order.orderId, recordedPolicyVersionIds);
  } catch (err) {
    // 동의 기록 실패는 funnel 로그만 — 결제 차단 안 함.
    consentRecordError = true;
    console.error('[prepare] recordConsentsForPayment failed', err);
  }

  await logPaymentFunnelEvent(supabase, {
    stage: 'prepare_ready',
    userId: user.id,
    packageId,
    amount: resolvedAmount,
    orderId: order.orderId,
    metadata: {
      scopeKey: paymentScope?.scopeKey ?? null,
      consentAcceptedKinds: acceptedKinds,
      consentRecorded: recordedPolicyVersionIds.length > 0,
      consentRecordCount: recordedPolicyVersionIds.length,
      consentRecordError,
      paymentMethodCode,
    },
  });

  return NextResponse.json({
    ok: true,
    authenticated: true,
    alreadyPurchased: false,
    scopeKey: paymentScope?.scopeKey ?? null,
    orderId: order.orderId,
    // 2026-07-07 — 청구 금액은 order.amount(리졸버 스냅샷). 클라이언트는 이 값으로 PG 청구해야
    //   confirm/return 의 order.amount 검증과 일치(카탈로그 prop 사용 시 가격 변경 후 전건 거부).
    amount: resolvedAmount,
    // 2026-06-26 — 결제창 분기용 PG. 클라이언트가 toss SDK ↔ nicepay 결제창을 선택.
    provider: getPaymentProvider(),
  });
}
