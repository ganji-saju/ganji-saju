import { NextRequest, NextResponse } from 'next/server';
import {
  PERSONALITY_COMPATIBILITY_MINI_INCLUDED_SUBSCRIPTION_PLANS,
  PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
  PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/personality-compatibility';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function hasIncludedMembership(plan: string | null | undefined) {
  return PERSONALITY_COMPATIBILITY_MINI_INCLUDED_SUBSCRIPTION_PLANS.some(
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
        membershipPolicy: PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
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
      membershipPolicy: PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
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
      membershipPolicy: PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
    });
  }

  if (!hasSupabaseServiceEnv) {
    return NextResponse.json({
      authenticated: true,
      hasAccess: false,
      membershipIncluded: false,
      membershipPolicy: PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
    });
  }

  const entitlement = await getTasteProductEntitlement(
    user.id,
    PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
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
    membershipPolicy: PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
    subscriptionPlan: subscription?.status === 'active' ? subscription.plan : null,
  });
}
