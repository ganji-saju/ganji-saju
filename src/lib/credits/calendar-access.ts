import { createServiceClient } from '@/lib/supabase/server';
import {
  deductCredits,
  getCredits,
  unlockCreditsOnce,
} from './deduct';
import { getMemberTier } from '@/lib/subscription';

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

  // [멤버십 게이트] 전 앞에 삽입: premium 은 달력 무제한(MEMBER_QUOTAS.premium.calendarMonthly=null).
  //   2026-09-01 — 월쿼터 소진 분기는 plus 등급 전용이었고 그 등급이 사라져 함께 삭제했다.
  if (await getMemberTier(userId)) {
    await recordFortuneCalendarMonthAccess(userId, readingKey, year, month);
    return { success: true, remaining: await getRemainingCredits(userId), reused: false, viaMembership: true };
  }

  // [레거시 전 경로] 기존 잔액 보유자 소진용 — 삭제 금지
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
