import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSubscriptionPackage, isTasteProductPackage, type TasteProductId } from '@/lib/payments/catalog';
import { confirmPayment } from '@/lib/payments/toss';
import { validatePaymentConfirmationPayload } from '@/lib/payments/confirmation';
import { addCredits, getCredits } from '@/lib/credits/deduct';
import { grantLifetimeReportEntitlement } from '@/lib/report-entitlements';
import {
  buildMonthlyCalendarScopeKey,
  buildReadingProductScopeKey,
  buildTodayDetailScopeKey,
  grantTasteProductEntitlement,
} from '@/lib/product-entitlements';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import { activateMembershipSubscription } from '@/lib/subscription';

function parseYearMonthScope(scope: string | null) {
  const match = scope?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  return { year, month };
}

async function resolveTasteProductScope(
  productId: TasteProductId,
  slug: string | null,
  scope: string | null
) {
  if (productId === 'love-question' || productId === 'money-pattern' || productId === 'work-flow') return null;
  if (!slug) return null;
  if (productId === 'today-detail') return buildTodayDetailScopeKey(slug);

  const reading = await resolveReading(slug);
  const readingKey = reading ? toSlug(reading.input) : slug;

  if (productId === 'monthly-calendar') {
    const yearMonth = parseYearMonthScope(scope);
    return yearMonth
      ? buildMonthlyCalendarScopeKey(readingKey, yearMonth.year, yearMonth.month)
      : buildReadingProductScopeKey(readingKey);
  }

  return buildReadingProductScopeKey(readingKey);
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

  let lifetimeReadingKey: string | null = null;
  let lifetimeLegacyKeys: string[] = [];

  if (pkg.kind === 'lifetime_report' && slug) {
    const reading = await resolveReading(slug);
    lifetimeReadingKey = reading ? toSlug(reading.input) : slug;

    if (reading && slug !== lifetimeReadingKey) {
      lifetimeLegacyKeys = [slug];
    }
  }

  const entitlement =
    pkg.kind === 'lifetime_report' && lifetimeReadingKey
      ? await grantLifetimeReportEntitlement(user.id, lifetimeReadingKey, {
          orderId,
          paymentKey,
          amount: parsedAmount,
        }, lifetimeLegacyKeys)
      : null;

  const productEntitlement =
    isTasteProductPackage(pkg)
      ? await grantTasteProductEntitlement(user.id, pkg.tasteProductId, {
          scopeKey: await resolveTasteProductScope(pkg.tasteProductId, slug, scope),
          orderId,
          paymentKey,
          amount: parsedAmount,
          packageId: pkg.id,
        })
      : null;

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
