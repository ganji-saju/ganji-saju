import { createServiceClient } from '@/lib/supabase/server';
import {
  deductCredits,
  getCredits,
  unlockCreditsOnce,
} from './deduct';
import { getMemberTier } from '@/lib/subscription';
import {
  MEMBER_QUOTAS,
  MEMBER_BENEFIT_KEYS,
  consumeMemberBenefit,
  monthlyPeriodKey,
} from './member-benefits';

export const FORTUNE_CALENDAR_MONTH_ACCESS_KIND = 'fortune_calendar_month_access';

export interface FortuneCalendarUnlockResult {
  success: boolean;
  remaining: number;
  reused: boolean;
  error?: string;
  viaMembership?: boolean;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function getFortuneCalendarMonthKey(year: number, month: number) {
  return `${year}-${pad(month)}`;
}

function getFortuneCalendarMonthAccessMetadata(
  readingKey: string,
  year: number,
  month: number
) {
  return {
    kind: FORTUNE_CALENDAR_MONTH_ACCESS_KIND,
    readingKey,
    yearMonth: getFortuneCalendarMonthKey(year, month),
    year,
    month,
  };
}

async function getRemainingCredits(userId: string) {
  const credits = await getCredits(userId);
  return (credits?.balance ?? 0) + (credits?.subscription_balance ?? 0);
}

export async function hasFortuneCalendarMonthAccess(
  userId: string,
  readingKey: string,
  year: number,
  month: number
) {
  const service = await createServiceClient();
  const yearMonth = getFortuneCalendarMonthKey(year, month);
  const { data, error } = await service
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', 'calendar')
    .contains('metadata', {
      kind: FORTUNE_CALENDAR_MONTH_ACCESS_KIND,
      readingKey,
      yearMonth,
    })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data && data.length > 0);
}

export async function recordFortuneCalendarMonthAccess(
  userId: string,
  readingKey: string,
  year: number,
  month: number
) {
  const service = await createServiceClient();
  const { error } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'use',
    feature: 'calendar',
    metadata: getFortuneCalendarMonthAccessMetadata(readingKey, year, month),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function unlockFortuneCalendarMonth(
  userId: string,
  readingKey: string,
  year: number,
  month: number
): Promise<FortuneCalendarUnlockResult> {
  if (await hasFortuneCalendarMonthAccess(userId, readingKey, year, month)) {
    return {
      success: true,
      remaining: await getRemainingCredits(userId),
      reused: true,
    };
  }

  // [멤버십 게이트] 코인 앞에 삽입: premium 무제한 / plus 월쿼터 소진
  const tier = await getMemberTier(userId);
  if (tier) {
    const limit = MEMBER_QUOTAS[tier].calendarMonthly; // null = 무제한(premium)
    const granted =
      limit === null
        ? true
        : await consumeMemberBenefit(userId, MEMBER_BENEFIT_KEYS.calendarMonthly.benefit, monthlyPeriodKey(), limit);
    if (granted) {
      await recordFortuneCalendarMonthAccess(userId, readingKey, year, month);
      return { success: true, remaining: await getRemainingCredits(userId), reused: false, viaMembership: true };
    }
    // plus 한도 초과 → 아래 레거시 코인/페이월로 폴스루
  }

  // [레거시 코인 경로] 기존 잔액 보유자 소진용 — 삭제 금지
  const accessMetadata = getFortuneCalendarMonthAccessMetadata(readingKey, year, month);
  const atomicResult = await unlockCreditsOnce(userId, 'calendar', accessMetadata);

  if (atomicResult) {
    return atomicResult;
  }

  const deducted = await deductCredits(userId, 'calendar');

  if (!deducted.success) {
    return {
      success: false,
      remaining: deducted.remaining,
      reused: false,
      error: deducted.error,
    };
  }

  await recordFortuneCalendarMonthAccess(userId, readingKey, year, month);

  return {
    success: true,
    remaining: deducted.remaining,
    reused: false,
  };
}
