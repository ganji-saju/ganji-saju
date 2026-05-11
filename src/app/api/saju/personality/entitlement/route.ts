import { NextRequest, NextResponse } from 'next/server';
import {
  SAJU_PERSONALITY_MINI_INCLUDED_SUBSCRIPTION_PLANS,
  SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
  SAJU_PERSONALITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/saju-personality';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function hasIncludedMembership(plan: string | null | undefined) {
  return SAJU_PERSONALITY_MINI_INCLUDED_SUBSCRIPTION_PLANS.some(
    (includedPlan) => includedPlan === plan
  );
}

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get('scope')?.trim() || null;

  if (!scope) {
    return NextResponse.json(
      {
        authenticated: false,
        hasAccess: false,
        membershipIncluded: false,
        membershipPolicy: SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
        productCode: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
        error: '결과 범위가 필요합니다.',
      },
      { status: 400 }
    );
  }

  if (!hasSupabaseServerEnv) {
    return NextResponse.json({
      authenticated: false,
      hasAccess: false,
      membershipIncluded: false,
      membershipPolicy: SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
      productCode: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      hasAccess: false,
      membershipIncluded: false,
      membershipPolicy: SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
      productCode: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    });
  }

  if (!hasSupabaseServiceEnv) {
    return NextResponse.json({
      authenticated: true,
      hasAccess: false,
      membershipIncluded: false,
      membershipPolicy: SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
      productCode: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    });
  }

  const entitlement = await getTasteProductEntitlement(
    user.id,
    SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    scope
  );
  const subscription = await getManagedSubscription(user.id).catch(() => null);
  const membershipIncluded =
    subscription?.status === 'active' && hasIncludedMembership(subscription.plan);

  return NextResponse.json({
    authenticated: true,
    hasAccess: Boolean(entitlement || membershipIncluded),
    reason: entitlement ? 'entitlement' : membershipIncluded ? 'membership' : null,
    membershipIncluded,
    membershipPolicy: SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
    productCode: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    subscriptionPlan: subscription?.status === 'active' ? subscription.plan : null,
  });
}
