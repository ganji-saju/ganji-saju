import { createServiceClient } from '@/lib/supabase/server';

export type Feature =
  | 'detail_report'   // 10 크레딧 (9,900원 / 코인단가 990)
  | 'compat'          // 10 크레딧 (궁합 9,900원)
  | 'ai_chat'         // 3 크레딧 / 3회 묶음 (대화상담 = 무료 시작, 9,900 정책 대상 아님)
  | 'daewoon'         // 3 크레딧 (미사용 — 유지)
  | 'calendar';       // 10 크레딧 (월간 캘린더 9,900원)

// 2026-06-23 — 소액상품 9,900원 단일가 통일. 코인 1개 = 990원 기준이라 9,900원 상품 = 10코인 차감.
//   9,900 대상 상품과 연결된 feature(detail_report·compat·calendar)만 적용. ai_chat(대화상담=무료
//   시작)·daewoon(미사용)은 유지. 코인팩은 9,900원 = 15코인(50% 보너스)이라 한 번 충전으로
//   상품 1개(10코인) + 5코인 여유 → 코인 결제 = 직접결제 대비 우대(재방문 유인).
const CREDIT_COSTS: Record<Feature, number> = {
  detail_report: 10,
  compat: 10,
  ai_chat: 3,
  daewoon: 3,
  calendar: 10,
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

  if (!data) return null;

  // user_credits.balance 는 비만료 lot 합으로 동기화되는 캐시값이지만, 시간 경과만으로
  // lot 이 만료된 경우(차감/충전 이벤트 없음) 일시적으로 과대 표시될 수 있다. 결제 코인은
  // 1년 만료 모델이므로 표시 잔액은 비만료 lot 합으로 재계산한다(구독 잔액은 그대로).
  const nonExpired = await getNonExpiredLotBalance(userId);
  return { balance: nonExpired, subscription_balance: data.subscription_balance };
}

// 비만료 credit_lots 의 amount_remaining 합 — 만료된 코인을 제외한 실제 보유 결제 코인.
// credit_lots 가 없는(레거시 미백필) 환경에서는 user_credits.balance 로 폴백한다.
export async function getNonExpiredLotBalance(userId: string): Promise<number> {
  const supabase = await createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('credit_lots')
    .select('amount_remaining')
    .eq('user_id', userId)
    .gt('expires_at', nowIso);

  if (error) {
    // credit_lots 테이블이 아직 없거나 조회 실패 시 — 기존 balance 캐시로 폴백.
    const { data: fallback } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();
    return fallback?.balance ?? 0;
  }

  return (data ?? []).reduce((sum, lot) => sum + (lot.amount_remaining ?? 0), 0);
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

  // add_credits RPC: type='subscription' 은 subscription_balance(무만료) 증가,
  // 그 외('purchase' 등)는 결제+1년 만료 lot 으로 적립(040 마이그레이션). 거래 이력도 남긴다.
  const { error } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_metadata: metadata,
  });

  if (error) {
    throw new Error(error.message);
  }
}

// 결제 코인 1년 만료 lot 을 직접 적립한다(거래 이력은 별도). 만료 시각을 명시하고 싶을 때 사용.
// expiresAt 미지정 시 now()+1년. 일반 결제 충전은 addCredits(...,'purchase')로 충분하다.
export async function addCreditLot(
  userId: string,
  amount: number,
  options: { expiresAt?: Date | null; source?: string; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  const supabase = await createServiceClient();

  await supabase.rpc('add_credit_lot', {
    p_user_id: userId,
    p_amount: amount,
    p_expires_at: options.expiresAt ? options.expiresAt.toISOString() : null,
    p_source: options.source ?? 'purchase',
    p_metadata: options.metadata ?? {},
  });
}
