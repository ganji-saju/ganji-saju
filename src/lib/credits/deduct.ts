import { createServiceClient } from '@/lib/supabase/server';

export type Feature =
  | 'detail_report'   // 1 크레딧
  | 'compat'          // 2 크레딧
  | 'ai_chat'         // 3 크레딧 / 3회 묶음
  | 'daewoon'         // 3 크레딧
  | 'calendar';       // 2 크레딧

const CREDIT_COSTS: Record<Feature, number> = {
  detail_report: 1,
  compat: 2,
  ai_chat: 3,
  daewoon: 3,
  calendar: 2,
};

export function isFeature(value: unknown): value is Feature {
  return typeof value === 'string' && value in CREDIT_COSTS;
}

export function getFeatureCost(feature: Feature) {
  return CREDIT_COSTS[feature];
}

export interface IdempotentCreditUnlockResult {
  success: boolean;
  remaining: number;
  reused: boolean;
  error?: string;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function parseIdempotentCreditUnlockResult(data: unknown): IdempotentCreditUnlockResult {
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  return {
    success: readBoolean(payload.success),
    remaining: readNumber(payload.remaining),
    reused: readBoolean(payload.reused),
    error: readString(payload.error),
  };
}

function isMissingIdempotentUnlockRpc(error: unknown) {
  const payload = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const code = readString(payload.code);
  const message = readString(payload.message) ?? '';

  return (
    code === 'PGRST202' ||
    message.includes('unlock_credit_feature_once') ||
    message.includes('Could not find the function')
  );
}

export async function getCredits(userId: string): Promise<{ balance: number; subscription_balance: number } | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('user_credits')
    .select('balance, subscription_balance')
    .eq('user_id', userId)
    .single();
  return data;
}

async function deductCreditsWithCost(
  userId: string,
  feature: Feature,
  cost: number
): Promise<{ success: boolean; remaining: number; error?: string }> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_cost: cost,
    p_feature: feature,
  });

  if (error || !data?.success) {
    return {
      success: false,
      remaining: data?.remaining ?? 0,
      error: error?.message ?? '코인이 부족합니다.',
    };
  }

  return { success: true, remaining: data.remaining };
}

export async function deductCredits(
  userId: string,
  feature: Feature
): Promise<{ success: boolean; remaining: number; error?: string }> {
  return deductCreditsWithCost(userId, feature, CREDIT_COSTS[feature]);
}

export async function unlockCreditsOnce(
  userId: string,
  feature: Feature,
  accessMetadata: Record<string, unknown>,
  cost = CREDIT_COSTS[feature]
): Promise<IdempotentCreditUnlockResult | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc('unlock_credit_feature_once', {
    p_user_id: userId,
    p_feature: feature,
    p_cost: cost,
    p_access_metadata: accessMetadata,
  });

  if (error) {
    if (isMissingIdempotentUnlockRpc(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return parseIdempotentCreditUnlockResult(data);
}

export async function deductCreditsAmount(
  userId: string,
  feature: Feature,
  cost: number
): Promise<{ success: boolean; remaining: number; error?: string }> {
  return deductCreditsWithCost(userId, feature, cost);
}

export async function addCredits(
  userId: string,
  amount: number,
  type: 'purchase' | 'subscription',
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = await createServiceClient();

  await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_metadata: metadata,
  });
}
