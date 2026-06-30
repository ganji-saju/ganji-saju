// 2026-05-16 — 클라이언트 컴포넌트가 결제 전 entitlement 를 확인하는 단일 엔드포인트.
// premium-lock-card, fortune-calendar-panel, compatibility-result-view,
// notification-center-page 가 공유한다.
//
// 요청: GET ?productId=...&slug=...&scope=...
// 응답: { hasEntitlement: boolean, openHref: string | null, reason: string | null }
//
// 멤버십 구독은 별도 productId='subscription' + plan 파라미터로 처리.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTasteProductPackage,
  getMembershipPackage,
  isTasteProductId,
} from '@/lib/payments/catalog';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { getManagedSubscription } from '@/lib/subscription';
import {
  buildPurchasedProductHref,
  resolvePaymentProductScope,
} from '@/lib/payments/product-scope';
import { checkTodayDetailAccess } from '@/lib/saju/today-detail-access';
import { userHasLegacyCoins } from '@/lib/credits/legacy-coins';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const productId = searchParams.get('productId');
  const slug = searchParams.get('slug') ?? undefined;
  const scope = searchParams.get('scope') ?? undefined;
  const plan = searchParams.get('plan');

  if (!productId) {
    return NextResponse.json(
      { error: 'productId is required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 레거시 결제코인 보유 여부 — 코인 sunset 후 코인옵션 노출 대상 판정용 (read-only).
  const hasLegacyCoins = user ? await userHasLegacyCoins(user.id) : false;

  if (!user) {
    return NextResponse.json({
      hasEntitlement: false,
      openHref: null,
      reason: 'unauthenticated',
      hasLegacyCoins: false,
    });
  }

  // === 멤버십 구독 ===
  if (productId === 'subscription') {
    if (plan !== 'basic' && plan !== 'premium' && plan !== 'plus') {
      return NextResponse.json(
        { error: 'plan must be basic | premium | plus' },
        { status: 400 }
      );
    }
    const normalizedPlan = plan === 'plus' ? 'basic' : plan;
    const subscriptionPlanId =
      normalizedPlan === 'premium' ? 'premium_monthly' : 'plus_monthly';
    const subscription = await getManagedSubscription(user.id);
    const isActive =
      subscription &&
      subscription.status === 'active' &&
      subscription.plan === subscriptionPlanId;
    return NextResponse.json({
      hasEntitlement: Boolean(isActive),
      openHref: isActive ? '/my/billing' : null,
      reason: isActive ? 'active-subscription' : null,
      hasLegacyCoins,
    });
  }

  // === lifetime-report ===
  if (productId === 'lifetime-report') {
    const pkg = getMembershipPackage('lifetime');
    if (!pkg) {
      return NextResponse.json({ hasEntitlement: false, openHref: null, reason: null, hasLegacyCoins });
    }
    const paymentScope = await resolvePaymentProductScope({ pkg, slug, scope });
    if (!paymentScope?.readingKey) {
      return NextResponse.json({ hasEntitlement: false, openHref: null, reason: null, hasLegacyCoins });
    }
    const entitlement = await getLifetimeReportEntitlement(
      user.id,
      paymentScope.readingKey,
      paymentScope.slug ? [paymentScope.slug] : []
    );
    return NextResponse.json({
      hasEntitlement: Boolean(entitlement),
      openHref: entitlement
        ? buildPurchasedProductHref('lifetime-report', slug, { scope })
        : null,
      reason: entitlement ? 'lifetime-purchased' : null,
      hasLegacyCoins,
    });
  }

  // === taste_product (today-detail / love-question / money-pattern / work-flow / monthly-calendar / year-core) ===
  if (!isTasteProductId(productId)) {
    return NextResponse.json(
      { error: 'unsupported productId' },
      { status: 400 }
    );
  }
  const pkg = getTasteProductPackage(productId);
  if (!pkg) {
    return NextResponse.json({ hasEntitlement: false, openHref: null, reason: null, hasLegacyCoins });
  }

  // today-detail 은 readingKey(안정) + legacy readingId + coin 을 모두 보는 단일 진입점
  //   checkTodayDetailAccess 로 통일 — 사주 재생성·경로 교차로 slug 가 바뀌어도 인식돼
  //   결제 무한반복을 막는다(SSR 게이트·checkout 과 동일 판정).
  if (productId === 'today-detail') {
    const access = await checkTodayDetailAccess(slug ?? '');
    return NextResponse.json({
      hasEntitlement: access.hasAccess,
      openHref: access.hasAccess ? buildPurchasedProductHref(productId, slug, { scope }) : null,
      reason: access.hasAccess
        ? access.source?.kind === 'credit-unlock'
          ? 'coin-unlocked'
          : 'product-purchased'
        : null,
      hasLegacyCoins,
    });
  }

  const paymentScope = await resolvePaymentProductScope({ pkg, slug, scope });
  const entitlement = await getTasteProductEntitlement(
    user.id,
    productId,
    paymentScope?.scopeKey ?? null
  );

  const has = Boolean(entitlement);
  return NextResponse.json({
    hasEntitlement: has,
    openHref: has ? buildPurchasedProductHref(productId, slug, { scope }) : null,
    reason: has ? 'product-purchased' : null,
    hasLegacyCoins,
  });
}
