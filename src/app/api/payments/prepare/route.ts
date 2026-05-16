import { NextRequest, NextResponse } from 'next/server';
import {
  getPackage,
  isSubscriptionPackage,
  isTasteProductPackage,
} from '@/lib/payments/catalog';
import {
  buildPurchasedProductHref,
  resolvePaymentProductScope,
} from '@/lib/payments/product-scope';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { hasTodayFortunePremiumAccess } from '@/lib/credits/detail-report-access';
import { createClient } from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';
// 2026-05-16 PR (B1) — funnel 단계 기록. admin/payment-funnel 대시보드 데이터 source.
import { logPaymentFunnelEvent } from '@/lib/payments/funnel-log';

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

  const paymentScope = await resolvePaymentProductScope({ pkg, slug, scope });
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
  const coinUnlockedTodayDetail =
    isTasteProductPackage(pkg) &&
    pkg.tasteProductId === 'today-detail' &&
    paymentScope.slug
      ? await hasTodayFortunePremiumAccess(user.id, paymentScope.slug)
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

  await logPaymentFunnelEvent(supabase, {
    stage: 'prepare_ready',
    userId: user.id,
    packageId,
    amount: pkg.price ?? null,
    metadata: { scopeKey: paymentScope.scopeKey },
  });

  return NextResponse.json({
    ok: true,
    authenticated: true,
    alreadyPurchased: false,
    scopeKey: paymentScope.scopeKey,
  });
}
