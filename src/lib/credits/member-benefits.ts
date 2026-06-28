// 2026-06-28 — 프리미엄 멤버십 혜택 쿼터(서버). consume_member_benefit RPC(056) 래퍼 +
//   KST 기간키 헬퍼. 멤버 판별(isPremiumMember)은 호출부에서 선행.
import { createServiceClient } from '@/lib/supabase/server';

export const MEMBER_BENEFITS = {
  /** 멤버 매일 대화 5건 무료(일 단위 리셋). 비멤버 평생 3턴과 별개. */
  dialogueDaily: { benefit: 'dialogue_daily', limit: 5, period: 'day' },
  /** 멤버 궁합 월 3회 무료(월 단위 리셋). */
  compatMonthly: { benefit: 'compat_monthly', limit: 3, period: 'month' },
} as const;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 일 기간키 'YYYY-MM-DD'. */
export function dailyPeriodKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** KST 기준 월 기간키 'YYYY-MM'. */
export function monthlyPeriodKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 7);
}

/** 한도 내면 +1 후 true, 초과면 false(원자적). 실패(RPC 오류) 시 false(보수적 — 무료 미적용). */
export async function consumeMemberBenefit(
  userId: string,
  benefit: string,
  periodKey: string,
  limit: number
): Promise<boolean> {
  if (!userId) return false;
  const service = await createServiceClient();
  const { data, error } = await service.rpc('consume_member_benefit', {
    p_user_id: userId,
    p_benefit: benefit,
    p_period_key: periodKey,
    p_limit: limit,
  });
  if (error) return false;
  return data === true;
}

/** 현재 사용량 조회(소비 없음). 오류 시 limit 으로 간주(남은 0 표시). */
export async function getMemberBenefitUsed(
  userId: string,
  benefit: string,
  periodKey: string
): Promise<number> {
  if (!userId) return 0;
  const service = await createServiceClient();
  const { data, error } = await service.rpc('get_member_benefit_used', {
    p_user_id: userId,
    p_benefit: benefit,
    p_period_key: periodKey,
  });
  if (error || typeof data !== 'number') return 0;
  return data;
}
