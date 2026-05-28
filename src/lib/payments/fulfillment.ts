import { addCredits, getCredits } from '@/lib/credits/deduct';
import {
  getCreditGrantType,
  getPackage,
  getTasteProductPackage,
  isBundlePackage,
  isSubscriptionPackage,
  isTasteProductPackage,
} from '@/lib/payments/catalog';
import { grantBundleComponents } from '@/lib/payments/bundle';
import {
  claimPaymentOrderFulfillment,
  getPaymentOrderByOrderId,
  markPaymentOrderFailed,
  markPaymentOrderFulfilled,
  type PaymentOrder,
  type PaymentOrderSource,
  type TossPaymentObject,
  validateTossPaymentAgainstOrder,
} from '@/lib/payments/order-ledger';
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
import { resolveMoonlightCounselor } from '@/lib/counselors';
import { getUserProfileById } from '@/lib/profile';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import { upsertTodayFortuneResultSnapshot } from '@/lib/today-fortune/result-snapshots';
import { activateMembershipSubscription, getManagedSubscription } from '@/lib/subscription';

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

async function snapshotTodayDetailFulfillment(input: {
  userId: string;
  paymentScope: PaymentProductScope | null;
  order: PaymentOrder;
  paymentKey: string | null;
  entitlementId?: string | null;
}) {
  if (input.paymentScope?.productId !== 'today-detail' || !input.paymentScope.reading) return;

  const sourceSessionId =
    input.paymentScope.slug ?? input.order.slug ?? input.paymentScope.reading.id;

  try {
    const profile = await getUserProfileById(input.userId);
    const counselorId = resolveMoonlightCounselor(null, profile.preferredCounselor);
    await upsertTodayFortuneResultSnapshot({
      userId: input.userId,
      reading: input.paymentScope.reading,
      sourceSessionId,
      concernId: normalizeConcernId(input.order.scope),
      counselorId,
      accessSource: 'taste-product',
      entitlementId: input.entitlementId ?? null,
      paymentOrderId: input.order.id,
      paymentKey: input.paymentKey,
    });
  } catch (error) {
    console.warn('today-detail fulfillment snapshot failed', error);
  }
}

export interface PaymentFulfillmentResult {
  success: true;
  alreadyFulfilled: boolean;
  credits: number;
  totalCredits: number | null;
  subscription: Awaited<ReturnType<typeof getManagedSubscription>> | null;
  entitlement: Awaited<ReturnType<typeof grantLifetimeReportEntitlement>> | null;
  productEntitlement: Awaited<ReturnType<typeof grantTasteProductEntitlement>> | null;
  bundleGrants: Awaited<ReturnType<typeof grantBundleComponents>> | null;
  product: string | null;
  plan: string | null;
}

export async function buildAlreadyFulfilledResult(
  order: PaymentOrder
): Promise<PaymentFulfillmentResult> {
  const pkg = getPackage(order.packageId);
  if (!pkg) {
    throw new Error('결제 상품을 찾지 못했습니다.');
  }

  const updatedCredits = pkg.credits > 0 ? await getCredits(order.userId) : null;
  const subscription = isSubscriptionPackage(pkg)
    ? await getManagedSubscription(order.userId)
    : null;

  return {
    success: true,
    alreadyFulfilled: true,
    credits: pkg.credits,
    totalCredits: updatedCredits
      ? (updatedCredits.balance ?? 0) + (updatedCredits.subscription_balance ?? 0)
      : null,
    subscription,
    entitlement: null,
    productEntitlement: null,
    bundleGrants: null,
    product: isTasteProductPackage(pkg) ? pkg.tasteProductId : null,
    plan: 'planSlug' in pkg ? pkg.planSlug ?? null : null,
  };
}

export async function fulfillPaymentOrder(input: {
  order: PaymentOrder;
  payment: TossPaymentObject;
  source: PaymentOrderSource;
}): Promise<PaymentFulfillmentResult> {
  const validation = validateTossPaymentAgainstOrder(input.order, input.payment);
  if (!validation.ok) {
    await markPaymentOrderFailed({
      orderId: input.order.orderId,
      status: 'fulfillment_failed',
      error: validation.error,
      source: input.source,
      payment: input.payment,
    });
    throw new Error(validation.error);
  }

  if (input.payment.status && input.payment.status !== 'DONE') {
    throw new Error(`아직 지급할 수 없는 Toss 결제 상태입니다: ${input.payment.status}`);
  }

  if (input.order.status === 'fulfilled' || input.order.status === 'fulfilling') {
    return buildAlreadyFulfilledResult(input.order);
  }

  const claimed = await claimPaymentOrderFulfillment(input.order.orderId);
  if (!claimed) {
    const latest = await getPaymentOrderByOrderId(input.order.orderId);
    if (latest?.status === 'fulfilled' || latest?.status === 'fulfilling') {
      return buildAlreadyFulfilledResult(latest);
    }
    throw new Error('결제 지급 작업을 시작하지 못했습니다.');
  }

  const pkg = getPackage(claimed.packageId);
  if (!pkg) {
    await markPaymentOrderFailed({
      orderId: claimed.orderId,
      status: 'fulfillment_failed',
      error: '결제 상품을 찾지 못했습니다.',
      source: input.source,
      payment: input.payment,
    });
    throw new Error('결제 상품을 찾지 못했습니다.');
  }

  try {
    let totalCredits: number | null = null;
    const paymentKey = input.payment.paymentKey ?? claimed.paymentKey;
    const paymentScope = await attachOwnedReading(
      await resolvePaymentProductScope({ pkg, slug: claimed.slug, scope: claimed.scope }),
      claimed.userId
    );

    if (pkg.credits > 0) {
      await addCredits(claimed.userId, pkg.credits, getCreditGrantType(pkg), {
        orderId: claimed.orderId,
        packageId: pkg.id,
        paymentKey,
      });
      const updatedCredits = await getCredits(claimed.userId);
      totalCredits =
        (updatedCredits?.balance ?? 0) + (updatedCredits?.subscription_balance ?? 0);
    }

    const subscription = isSubscriptionPackage(pkg)
      ? await activateMembershipSubscription(claimed.userId, {
          plan: pkg.subscriptionPlan,
        })
      : null;

    const entitlement =
      pkg.kind === 'lifetime_report' && paymentScope?.readingKey
        ? await grantLifetimeReportEntitlement(
            claimed.userId,
            paymentScope.readingKey,
            {
              orderId: claimed.orderId,
              paymentKey,
              amount: claimed.amount,
            },
            paymentScope.slug ? [paymentScope.slug] : []
          )
        : null;

    const productEntitlement =
      isTasteProductPackage(pkg)
        ? await grantTasteProductEntitlement(claimed.userId, pkg.tasteProductId, {
            scopeKey: paymentScope?.scopeKey ?? null,
            orderId: claimed.orderId,
            paymentKey,
            amount: claimed.amount,
            packageId: pkg.id,
          })
        : null;

    const bundleGrants = isBundlePackage(pkg)
      ? await grantBundleComponents(
          pkg,
          {
            userId: claimed.userId,
            slug: claimed.slug,
            orderId: claimed.orderId,
            paymentKey,
            packageId: pkg.id,
          },
          {
            resolveScope: (args) => resolvePaymentProductScope(args),
            grant: (userId, productId, options) =>
              grantTasteProductEntitlement(userId, productId, options),
          }
        )
      : null;

    const bundledTodayDetailScope =
      isBundlePackage(pkg) && bundleGrants?.some((grant) => grant.tasteProductId === 'today-detail')
        ? await attachOwnedReading(
            await resolvePaymentProductScope({
              pkg: getTasteProductPackage('today-detail')!,
              slug: claimed.slug,
              scope: claimed.scope,
            }),
            claimed.userId
          )
        : null;

    const bundledTodayDetailEntitlement = bundledTodayDetailScope
      ? await getProductEntitlement(claimed.userId, 'today-detail', bundledTodayDetailScope.scopeKey)
      : null;

    const lifetimeProductEntitlement =
      pkg.kind === 'lifetime_report' && paymentScope?.scopeKey
        ? await getProductEntitlement(claimed.userId, 'lifetime-report', paymentScope.scopeKey)
        : null;

    if (paymentScope && (productEntitlement || lifetimeProductEntitlement)) {
      await upsertPaidReadingSnapshot({
        userId: claimed.userId,
        productId: paymentScope.productId,
        entitlement: productEntitlement ?? lifetimeProductEntitlement,
        scope: paymentScope,
        sourceSlug: claimed.slug,
      });
    }

    await snapshotTodayDetailFulfillment({
      userId: claimed.userId,
      paymentScope:
        isTasteProductPackage(pkg) && pkg.tasteProductId === 'today-detail'
          ? paymentScope
          : bundledTodayDetailScope,
      order: claimed,
      paymentKey,
      entitlementId:
        isTasteProductPackage(pkg) && pkg.tasteProductId === 'today-detail'
          ? productEntitlement?.id
          : bundledTodayDetailEntitlement?.id,
    });

    await markPaymentOrderFulfilled({
      orderId: claimed.orderId,
      payment: input.payment,
      source: input.source,
    });

    return {
      success: true,
      alreadyFulfilled: false,
      credits: pkg.credits,
      totalCredits,
      subscription,
      entitlement,
      productEntitlement,
      bundleGrants,
      product: isTasteProductPackage(pkg) ? pkg.tasteProductId : null,
      plan: 'planSlug' in pkg ? pkg.planSlug ?? null : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '결제 지급 처리 실패';
    await markPaymentOrderFailed({
      orderId: claimed.orderId,
      status: 'fulfillment_failed',
      error: message,
      source: input.source,
      payment: input.payment,
    });
    throw error;
  }
}
