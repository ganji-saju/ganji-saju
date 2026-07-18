import { createServiceClient } from '@/lib/supabase/server';
import type { AiGenerationSource } from '@/server/ai/openai-text';

// 2026-07-18 — "평생 3턴 무료" 폐지 → **하루 1턴 무료**(20260718 PPTX slide3
//   "질문 하나 대화상담 / 다 하루 1번으로 제한"). 평생 3턴은 한 번 소진되면 영영 끝이라
//   재방문 동기가 없었고, 매일 1턴은 누적으로는 더 후하면서 하루 사용량은 묶인다.
//   무료 턴 판정은 free-usage/daily-limit(free_dialogue_daily)로 옮겼고, 이 상수는
//   "도입 무료 턴 없음"을 뜻하는 0 이다 — 번들 과금 로직(3턴 묶음)은 그대로.
export const AI_CHAT_FREE_TURNS = 0;
export const AI_CHAT_BUNDLE_SIZE = 3;
export const AI_CHAT_BUNDLE_COST = 3;

export type AiChatBillingStatus =
  | 'free_intro'
  /** 2026-07-18 — 비멤버 하루 1턴 무료. */
  | 'free_daily'
  | 'result_intro_free'
  | 'member_daily_free'
  | 'charged_bundle'
  | 'bundle_included'
  | 'not_charged_fallback'
  | 'not_charged_safe_redirect'
  | 'auth_required'
  | 'insufficient_credits';

export interface AiChatBillingSummary {
  feature: 'ai_chat';
  cost: number;
  status: AiChatBillingStatus;
  remaining: number | null;
  turnNumber: number | null;
  freeTurnsRemaining: number | null;
  bundleTurnsRemaining: number | null;
  bundleSize: number;
}

export interface AiChatTurnPlan {
  status: 'free_intro' | 'charged_bundle' | 'bundle_included';
  cost: number;
  turnNumber: number;
  freeTurnsRemaining: number;
  bundleTurnsRemaining: number;
}

export function getAvailableCreditsTotal(
  credits: { balance: number; subscription_balance: number } | null | undefined
) {
  return Math.max(0, (credits?.balance ?? 0) + (credits?.subscription_balance ?? 0));
}

export function shouldChargeAiChat(source: AiGenerationSource) {
  return source === 'openai';
}

export function getAiChatTurnPlan(successfulTurns: number): AiChatTurnPlan {
  const turnNumber = successfulTurns + 1;

  if (successfulTurns < AI_CHAT_FREE_TURNS) {
    return {
      status: 'free_intro',
      cost: 0,
      turnNumber,
      freeTurnsRemaining: Math.max(0, AI_CHAT_FREE_TURNS - turnNumber),
      bundleTurnsRemaining: 0,
    };
  }

  const paidTurnsCompleted = successfulTurns - AI_CHAT_FREE_TURNS;
  const bundleTurn = (paidTurnsCompleted % AI_CHAT_BUNDLE_SIZE) + 1;

  return {
    status: bundleTurn === 1 ? 'charged_bundle' : 'bundle_included',
    cost: bundleTurn === 1 ? AI_CHAT_BUNDLE_COST : 0,
    turnNumber,
    freeTurnsRemaining: 0,
    bundleTurnsRemaining: AI_CHAT_BUNDLE_SIZE - bundleTurn,
  };
}

export async function getAiChatSuccessfulTurns(userId: string) {
  const service = await createServiceClient();
  const { count } = await service
    .from('credit_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', 'ai_chat');

  return count ?? 0;
}

export async function recordAiChatIncludedTurn(
  userId: string,
  plan: AiChatTurnPlan
) {
  const service = await createServiceClient();
  const { error } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'use',
    feature: 'ai_chat',
    metadata: {
      kind: 'ai_chat_turn',
      billingStatus: plan.status,
      turnNumber: plan.turnNumber,
      freeTurnsRemaining: plan.freeTurnsRemaining,
      bundleTurnsRemaining: plan.bundleTurnsRemaining,
      bundleSize: AI_CHAT_BUNDLE_SIZE,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function createAiChatBillingSummary(
  status: AiChatBillingStatus,
  remaining: number | null,
  plan?: Partial<AiChatTurnPlan>
): AiChatBillingSummary {
  return {
    feature: 'ai_chat',
    cost:
      status === 'charged_bundle' || status === 'insufficient_credits'
        ? AI_CHAT_BUNDLE_COST
        : plan?.cost ?? 0,
    status,
    remaining,
    turnNumber: plan?.turnNumber ?? null,
    freeTurnsRemaining: plan?.freeTurnsRemaining ?? null,
    bundleTurnsRemaining: plan?.bundleTurnsRemaining ?? null,
    bundleSize: AI_CHAT_BUNDLE_SIZE,
  };
}

export async function hasTodayResultFollowupFreeTurn(
  userId: string,
  sourceSessionId: string
) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', 'detail_report')
    .contains('metadata', {
      kind: 'today_result_followup',
      sourceSessionId,
    })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data && data.length > 0);
}

export async function recordTodayResultFollowupFreeTurn(
  userId: string,
  sourceSessionId: string,
  concernId?: string | null
) {
  const service = await createServiceClient();
  const { error } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'use',
    feature: 'detail_report',
    metadata: {
      kind: 'today_result_followup',
      sourceSessionId,
      concernId: concernId ?? null,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}
