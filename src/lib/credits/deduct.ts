import { createServiceClient } from '@/lib/supabase/server';
import { sumNonExpiredLots, type CreditLotRow } from '@/lib/credits/lot-balance';

// 2026-06-23 — 소액상품 9,900원 단일가 통일. 전 1개 = 990원 기준이라 9,900원 상품 = 10전 차감.
//   전팩은 9,900원 = 15전(50% 보너스)이라 한 번 충전으로 상품 1개(10전) + 5전 여유
//   → 전 결제 = 직접결제 대비 우대(재방문 유인).
// 2026-07-19 — 위 매핑이 **리터럴로 박혀 있어** 2026-07-18 카드가 인하(9,900 → 3,300)를
//   따라가지 못했다(같은 상품이 카드 3,300원 vs 전 10개 = 9,900원 상당으로 3배 괴리,
//   "전이 더 유리하다"는 설계 의도가 정반대로 뒤집힘). 이제 상수 정의를 순수 모듈
//   `./costs` 로 옮겨 **카탈로그 가격에서 파생**시킨다 — 이벤트가 끝나 가격이 9,900 으로
//   복귀하면 전 차감량도 자동으로 10 으로 돌아온다. 파생 규칙·근거는 costs.ts 주석 참조.
//   (이 파일은 server-only createServiceClient 를 import 하므로 클라 컴포넌트는
//    표시용 값을 costs.ts 에서 직접 가져가야 한다.)
import { CREDIT_COSTS, type Feature } from './costs';

export {
  CREDIT_COSTS,
  COIN_UNIT_KRW,
  coinCostForPackage,
  getFeatureCost,
  isFeature,
  type Feature,
} from './costs';

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
  // lot 이 만료된 경우(차감/충전 이벤트 없음) 일시적으로 과대 표시될 수 있다. 결제 재화는
  // 1년 만료 모델이므로 표시 잔액은 비만료 lot 합으로 재계산한다(구독 잔액은 그대로).
  const nonExpired = await getNonExpiredLotBalance(userId);
  return { balance: nonExpired, subscription_balance: data.subscription_balance };
}

// 비만료 credit_lots 의 amount_remaining 합 — 만료된 재화를 제외한 실제 보유 결제 재화.
// credit_lots 가 없는(레거시 미백필) 환경에서는 user_credits.balance 로 폴백한다.
export async function getNonExpiredLotBalance(userId: string): Promise<number> {
  const supabase = await createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  // expires_at 도 함께 조회해 sumNonExpiredLots 로 JS 측 만료 보정을 한 번 더 보장(이중 가드).
  const { data, error } = await supabase
    .from('credit_lots')
    .select('amount_remaining, expires_at')
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

  return sumNonExpiredLots((data ?? []) as CreditLotRow[], now);
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
      error: error?.message ?? '전이 부족합니다.',
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

// 2026-06-26 — 결제 취소/환불 시 충전 재화 회수. deduct_credits RPC 로 차감(잔액 범위).
//   addCredits(음수)는 양수 lot 적립 RPC 라 차감되지 않아 회수에 쓸 수 없다.
//   p_feature 는 거래 이력 라벨(예: 'nicepay-cancel'). 잔액 부족 시 success=false(음수 잔액 미생성).
export async function revokeCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; remaining: number; error?: string }> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_cost: amount,
    p_feature: reason,
  });

  if (error || !data?.success) {
    return {
      success: false,
      remaining: data?.remaining ?? 0,
      error: error?.message ?? '전 회수 실패(잔액 부족)',
    };
  }

  return { success: true, remaining: data.remaining };
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

// 결제 재화 1년 만료 lot 을 직접 적립한다(거래 이력은 별도). 만료 시각을 명시하고 싶을 때 사용.
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
