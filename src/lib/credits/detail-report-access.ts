import { createServiceClient } from '@/lib/supabase/server';
import {
  deductCredits,
  getCredits,
  isFeature,
  unlockCreditsOnce,
  type Feature,
} from './deduct';

export const DETAIL_REPORT_ACCESS_KIND = 'detail_report_access';
export const DETAIL_REPORT_DAILY_ACCESS_KIND = 'detail_report_daily_access';
export const TODAY_FORTUNE_PREMIUM_ACCESS_KIND = 'today_fortune_premium_access';

export interface CreditUsePayload {
  feature: Feature;
  slug: string | null;
}

export type CreditUsePayloadValidation =
  | {
      ok: true;
      payload: CreditUsePayload;
    }
  | {
      ok: false;
      error: string;
    };

export interface DetailReportUnlockResult {
  success: boolean;
  remaining: number;
  reused: boolean;
  error?: string;
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function validateCreditUsePayload(payload: unknown): CreditUsePayloadValidation {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: '요청 정보가 올바르지 않습니다.' };
  }

  const data = payload as Record<string, unknown>;
  const feature = readString(data, 'feature');
  const slug = readString(data, 'slug') || null;

  if (!isFeature(feature)) {
    return { ok: false, error: '지원하지 않는 기능입니다.' };
  }

  if (feature === 'detail_report' && !slug) {
    return { ok: false, error: '상세 해석을 열 결과가 필요합니다.' };
  }

  return {
    ok: true,
    payload: {
      feature,
      slug,
    },
  };
}

export function getKoreaAccessDay(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function getRemainingCredits(userId: string) {
  const credits = await getCredits(userId);
  return (credits?.balance ?? 0) + (credits?.subscription_balance ?? 0);
}

function getDetailReportAccessMetadata(readingKey: string) {
  return {
    kind: DETAIL_REPORT_ACCESS_KIND,
    readingKey,
  };
}

function getLegacyDailyDetailReportAccessMetadata(readingKey: string) {
  return {
    kind: DETAIL_REPORT_DAILY_ACCESS_KIND,
    readingKey,
  };
}

function getTodayFortunePremiumAccessMetadata(sourceSessionId: string, readingKey: string) {
  return {
    kind: TODAY_FORTUNE_PREMIUM_ACCESS_KIND,
    sourceSessionId,
    readingKey,
  };
}

async function hasFeatureAccess(
  userId: string,
  feature: Feature,
  metadata: Record<string, unknown>
) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', feature)
    .contains('metadata', metadata)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data && data.length > 0);
}

export async function hasDetailReportAccess(
  userId: string,
  readingKey: string
) {
  if (await hasFeatureAccess(userId, 'detail_report', getDetailReportAccessMetadata(readingKey))) {
    return true;
  }

  return hasFeatureAccess(
    userId,
    'detail_report',
    getLegacyDailyDetailReportAccessMetadata(readingKey)
  );
}

export async function hasTodayFortunePremiumAccess(
  userId: string,
  sourceSessionId: string
) {
  return hasFeatureAccess(userId, 'detail_report', {
    kind: TODAY_FORTUNE_PREMIUM_ACCESS_KIND,
    sourceSessionId,
  });
}

export async function recordDetailReportAccess(
  userId: string,
  readingKey: string
) {
  const service = await createServiceClient();
  const { error } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'use',
    feature: 'detail_report',
    metadata: getDetailReportAccessMetadata(readingKey),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordTodayFortunePremiumAccess(
  userId: string,
  readingKey: string,
  sourceSessionId: string
) {
  const service = await createServiceClient();
  const { error } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'use',
    feature: 'detail_report',
    metadata: getTodayFortunePremiumAccessMetadata(sourceSessionId, readingKey),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function unlockDetailReport(
  userId: string,
  readingKey: string
): Promise<DetailReportUnlockResult> {
  if (await hasDetailReportAccess(userId, readingKey)) {
    return {
      success: true,
      remaining: await getRemainingCredits(userId),
      reused: true,
    };
  }

  const accessMetadata = getDetailReportAccessMetadata(readingKey);
  const atomicResult = await unlockCreditsOnce(userId, 'detail_report', accessMetadata);

  if (atomicResult) {
    return atomicResult;
  }

  const deducted = await deductCredits(userId, 'detail_report');

  if (!deducted.success) {
    return {
      success: false,
      remaining: deducted.remaining,
      reused: false,
      error: deducted.error,
    };
  }

  await recordDetailReportAccess(userId, readingKey);

  return {
    success: true,
    remaining: deducted.remaining,
    reused: false,
  };
}

export async function unlockTodayFortunePremium(
  userId: string,
  readingKey: string,
  sourceSessionId: string
): Promise<DetailReportUnlockResult> {
  if (await hasTodayFortunePremiumAccess(userId, sourceSessionId)) {
    return {
      success: true,
      remaining: await getRemainingCredits(userId),
      reused: true,
    };
  }

  const accessMetadata = getTodayFortunePremiumAccessMetadata(sourceSessionId, readingKey);
  const atomicResult = await unlockCreditsOnce(userId, 'detail_report', accessMetadata);

  if (atomicResult) {
    return atomicResult;
  }

  const deducted = await deductCredits(userId, 'detail_report');

  if (!deducted.success) {
    return {
      success: false,
      remaining: deducted.remaining,
      reused: false,
      error: deducted.error,
    };
  }

  await recordTodayFortunePremiumAccess(userId, readingKey, sourceSessionId);

  return {
    success: true,
    remaining: deducted.remaining,
    reused: false,
  };
}

export async function unlockDailyDetailReport(
  userId: string,
  readingKey: string
): Promise<DetailReportUnlockResult> {
  return unlockDetailReport(userId, readingKey);
}
