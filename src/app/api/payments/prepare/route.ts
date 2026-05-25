import { NextRequest, NextResponse } from 'next/server';
import {
  getPackage,
  isBundlePackage,
  isSubscriptionPackage,
  isTasteProductPackage,
} from '@/lib/payments/catalog';
import { areAllBundleComponentsOwned } from '@/lib/payments/bundle';
import {
  buildPurchasedProductHref,
  resolvePaymentProductScope,
  type PaymentProductScope,
} from '@/lib/payments/product-scope';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import {
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
  const pkg = getPackage(packageId);

  if (!pkg) {
    return NextResponse.json({ error: '결제 상품을 찾지 못했습니다.' }, { status: 400 });
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
    if (!paymentScope) {
      return NextResponse.json({
        ok: true,
        authenticated: true,
        alreadyPurchased: false,
        scopeKey: null,
      });
    }

    const entitlement = isTasteProductPackage(pkg)
      ? await getTasteProductEntitlement(user.id, pkg.tasteProductId, paymentScope.scopeKey)
      : await getLifetimeReportEntitlement(
          user.id,
          paymentScope.readingKey ?? paymentScope.slug ?? '',
          paymentScope.slug ? [paymentScope.slug] : []
        );
    // today-detail 은 코인 경로(/api/credits/use·/api/today-fortune/unlock)로도 해제될 수
    // 있어, Toss 단건 결제 중복을 막으려면 코인 해제를 양쪽 키로 확인해야 한다:
    //   today-fortune 경로 = sourceSessionId(=slug) / saju 경로 = readingKey.
    // readingKey 는 today_fortune_premium_access·detail_report_access 두 kind 모두 조회.
    // ※ KST 일자 단위 fallback(hasTodayFortuneDailyAccess)은 의도적 제외 — 다른 사주의
    //   오늘 결제까지 막는 과잉 차단 방지(결제 차단은 scope 단위여야 함).
    const coinUnlockedTodayDetail =
      isTasteProductPackage(pkg) &&
      pkg.tasteProductId === 'today-detail' &&
      paymentScope.slug
        ? (await hasTodayFortunePremiumAccess(user.id, paymentScope.slug)) ||
          (paymentScope.readingKey
            ? (await hasTodayFortunePremiumAccessByReading(user.id, paymentScope.readingKey)) ||
              (await hasDetailReportAccess(user.id, paymentScope.readingKey))
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

  // 2026-05-18 Phase 3-C-1: 동의 검증 + DB 기록.
  // acceptedKinds 가 명시된 경우만 검증 (점진 전환 — 기존 결제 페이지 backward compat).
  // 미동의 시 400 + funnel_log blocked. 동의 시 recordUserConsent 호출 (consent_method='payment_explicit').
  const acceptedKindsRaw = Array.isArray(payload.acceptedKinds) ? payload.acceptedKinds : null;
  const acceptedKinds: PolicyKind[] | null = acceptedKindsRaw
    ? (acceptedKindsRaw.filter((k): k is PolicyKind =>
        typeof k === 'string' && (POLICY_KINDS as readonly string[]).includes(k)
      ))
    : null;

  if (acceptedKinds !== null) {
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
    // 동의 기록 — 활성 PolicyVersion fetch 후 user_policy_consents insert.
    // 실패해도 결제 자체는 진행 (graceful — 정책 본문 admin 입력 전이면 skip).
    try {
      await recordConsentsForPayment({
        userId: user.id,
        pkg,
        acceptedKinds,
        orderId: null, // confirm 시점에는 orderId 별도 처리 (후속 PR)
        userAgent: req.headers.get('user-agent') ?? null,
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req.headers.get('x-real-ip') ??
          null,
      });
    } catch (err) {
      // 동의 기록 실패는 funnel 로그만 — 결제 차단 안 함.
      console.error('[prepare] recordConsentsForPayment failed', err);
    }
  }

  await logPaymentFunnelEvent(supabase, {
    stage: 'prepare_ready',
    userId: user.id,
    packageId,
    amount: pkg.price ?? null,
    metadata: { scopeKey: paymentScope?.scopeKey ?? null, consentRecorded: acceptedKinds !== null },
  });

  return NextResponse.json({
    ok: true,
    authenticated: true,
    alreadyPurchased: false,
    scopeKey: paymentScope?.scopeKey ?? null,
  });
}
