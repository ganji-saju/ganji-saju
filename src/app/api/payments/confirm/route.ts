import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSubscriptionPackage, isTasteProductPackage } from '@/lib/payments/catalog';
import { confirmPayment } from '@/lib/payments/toss';
import { validatePaymentConfirmationPayload } from '@/lib/payments/confirmation';
import { addCredits, getCredits } from '@/lib/credits/deduct';
import { grantLifetimeReportEntitlement } from '@/lib/report-entitlements';
import {
  getProductEntitlement,
  grantTasteProductEntitlement,
} from '@/lib/product-entitlements';
import {
  resolvePaymentProductScope,
  type PaymentProductScope,
} from '@/lib/payments/product-scope';
import { upsertPaidReadingSnapshot } from '@/lib/payments/paid-reading-snapshots';
import { ensureReadingOwnedByUser } from '@/lib/saju/readings';
import { activateMembershipSubscription } from '@/lib/subscription';

async function attachOwnedReading(
  paymentScope: PaymentProductScope | null,
  userId: string
): Promise<PaymentProductScope | null> {
  if (!paymentScope?.reading) return paymentScope;
  const ownedReading = await ensureReadingOwnedByUser(paymentScope.reading, userId);
  return {
    ...paymentScope,
    reading: ownedReading,
  };
}

export async function POST(req: NextRequest) {
  const validation = validatePaymentConfirmationPayload(await req.json().catch(() => null));

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { paymentKey, orderId, amount: parsedAmount, slug, scope, pkg } = validation.input;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 토스페이먼츠 결제 승인
  const payment = await confirmPayment(paymentKey, orderId, parsedAmount).catch(err => {
    return NextResponse.json({ error: err.message }, { status: 400 });
  });

  if (payment instanceof NextResponse) return payment;

  let totalCredits: number | null = null;
  const paymentScope = await attachOwnedReading(
    await resolvePaymentProductScope({ pkg, slug, scope }),
    user.id
  );

  if (pkg.credits > 0) {
    await addCredits(user.id, pkg.credits, pkg.kind === 'subscription' ? 'subscription' : 'purchase', {
      orderId,
      packageId: pkg.id,
      paymentKey,
    });
    const updatedCredits = await getCredits(user.id);
    totalCredits =
      (updatedCredits?.balance ?? 0) + (updatedCredits?.subscription_balance ?? 0);
  }

  const subscription = isSubscriptionPackage(pkg)
    ? await activateMembershipSubscription(user.id, {
        plan: pkg.subscriptionPlan,
      })
    : null;

  const entitlement =
    pkg.kind === 'lifetime_report' && paymentScope?.readingKey
      ? await grantLifetimeReportEntitlement(user.id, paymentScope.readingKey, {
          orderId,
          paymentKey,
          amount: parsedAmount,
        }, paymentScope.slug ? [paymentScope.slug] : [])
      : null;

  const productEntitlement =
    isTasteProductPackage(pkg)
      ? await grantTasteProductEntitlement(user.id, pkg.tasteProductId, {
          scopeKey: paymentScope?.scopeKey ?? null,
          orderId,
          paymentKey,
          amount: parsedAmount,
          packageId: pkg.id,
        })
      : null;

  const lifetimeProductEntitlement =
    pkg.kind === 'lifetime_report' && paymentScope?.scopeKey
      ? await getProductEntitlement(user.id, 'lifetime-report', paymentScope.scopeKey)
      : null;

  if (paymentScope && (productEntitlement || lifetimeProductEntitlement)) {
    await upsertPaidReadingSnapshot({
      userId: user.id,
      productId: paymentScope.productId,
      entitlement: productEntitlement ?? lifetimeProductEntitlement,
      scope: paymentScope,
      sourceSlug: slug,
    });
  }

  return NextResponse.json({
    success: true,
    credits: pkg.credits,
    totalCredits,
    subscription,
    entitlement,
    productEntitlement,
    product: isTasteProductPackage(pkg) ? pkg.tasteProductId : null,
    plan: 'planSlug' in pkg ? pkg.planSlug : null,
  });
}
