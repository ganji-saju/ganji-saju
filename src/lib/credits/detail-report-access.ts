import { createServiceClient } from '@/lib/supabase/server';
import {
  deductCredits,
  getCredits,
  isFeature,
  unlockCreditsOnce,
  type Feature,
} from './deduct';
import { getMemberTier } from '@/lib/subscription';
import {
  MEMBER_QUOTAS,
  MEMBER_BENEFIT_KEYS,
  consumeMemberBenefit,
  monthlyPeriodKey,
} from './member-benefits';

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
  viaMembership?: boolean;
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

/**
 * KST 날짜('YYYY-MM-DD') → [그날 00:00, 다음날 00:00) 의 UTC ISO 구간(created_at 비교용).
 * 잘못된 형식이면 null. (Korea 는 no DST → 24h 고정.)
 */
export function kstDayRangeIso(
  dayKey: string
): { startIso: string; endIso: string } | null {
  const startMs = Date.parse(`${dayKey}T00:00:00+09:00`);
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + 86_400_000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
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

// 2026-06-05 — today-detail 일일 만료(영구 접근 버그 fix).
//   dayKey 포함 시 RPC(unlock_credit_feature_once)의 dedup(`metadata @> v_access_metadata`,
//   015 migration)이 일자별로 분리 → 날짜가 바뀌면 새 unlock 으로 재과금(일일 상품).
//   미지정 시 dayKey 생략 → legacy(영구) 호환. export: 메타데이터 단위 테스트용.
export function getTodayFortunePremiumAccessMetadata(
  sourceSessionId: string,
  readingKey: string,
  dayKey?: string
) {
  return {
    kind: TODAY_FORTUNE_PREMIUM_ACCESS_KIND,
    sourceSessionId,
    readingKey,
    ...(dayKey ? { dayKey } : {}),
  };
}

// dayKey 지정 시 해당 KST 일자(created_at)에 생성된 row 만 매치(일일 만료). 미지정 시 전체(영구).
async function hasFeatureAccess(
  userId: string,
  feature: Feature,
  metadata: Record<string, unknown>,
  dayKey?: string
) {
  const service = await createServiceClient();
  let query = service
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', feature)
    .contains('metadata', metadata);

  if (dayKey) {
    const range = kstDayRangeIso(dayKey);
    if (!range) return false;
    query = query.gte('created_at', range.startIso).lt('created_at', range.endIso);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data && data.length > 0);
}

export async function hasDetailReportAccess(
  userId: string,
  readingKey: string,
  // 2026-06-05 — today-detail 흐름에서 호출 시 todayKey 지정 → 당일 unlock 만 인정(일일 만료).
  //   다른 호출자(saju-detail 자체 게이트)는 미지정 → 기존 동작 유지.
  dayKey?: string
) {
  if (
    await hasFeatureAccess(userId, 'detail_report', getDetailReportAccessMetadata(readingKey), dayKey)
  ) {
    return true;
  }

  return hasFeatureAccess(
    userId,
    'detail_report',
    getLegacyDailyDetailReportAccessMetadata(readingKey),
    dayKey
  );
}

export async function hasTodayFortunePremiumAccess(
  userId: string,
  sourceSessionId: string,
  dayKey?: string
) {
  return hasFeatureAccess(
    userId,
    'detail_report',
    { kind: TODAY_FORTUNE_PREMIUM_ACCESS_KIND, sourceSessionId },
    dayKey
  );
}

// 2026-05-17 정확한 fix — PR #199 의 supabase MCP evidence 가 확정한 root cause:
//   production row 가 모두 kind=today_fortune_premium_access + readingKey 보유.
//   PR #196 의 coin-reading path 가 잘못된 kind (detail_report_access) 만 조회 →
//   같은 reading 의 새 sourceSessionId 진입에서 매번 매치 실패 → deduct.
//
// 올바른 매치: kind=today_fortune_premium_access + readingKey (sourceSessionId 무관).
// JSONB `@>` 가 metadata `{kind, sourceSessionId, readingKey, ...}` 에 `{kind, readingKey}`
// 포함 매치 — sourceSessionId 가 매번 새로 생성되어도 readingKey 일치하면 reused.
export async function hasTodayFortunePremiumAccessByReading(
  userId: string,
  readingKey: string,
  dayKey?: string
) {
  return hasFeatureAccess(
    userId,
    'detail_report',
    { kind: TODAY_FORTUNE_PREMIUM_ACCESS_KIND, readingKey },
    dayKey
  );
}

// 2026-05-17 사용자 명시 요구 — "같은 날 두 번 결제 차단".
// PR #196 의 sourceSessionId / readingKey 기반 fallback 이 어떤 이유로 매치 못
// 잡는 케이스 (RPC race / metadata 미스매치 / 새 reading 등) 대비 broadest
// fallback. 같은 user + feature='detail_report' + type='use' + 같은 KST 일자
// row 가 1개라도 있으면 reused — 차감 skip.
//
// Korea timezone day = [today 00:00 KST, today+1 00:00 KST) — Korea 는 no DST 라
// 24h fixed. timestamptz 컬럼 vs ISO UTC 비교.
export async function hasTodayFortuneDailyAccess(
  userId: string,
  dateKey: string = getKoreaAccessDay()
) {
  const range = kstDayRangeIso(dateKey);
  if (!range) {
    throw new Error(`Invalid dateKey for hasTodayFortuneDailyAccess: ${dateKey}`);
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', 'detail_report')
    .gte('created_at', range.startIso)
    .lt('created_at', range.endIso)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data && data.length > 0);
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
  sourceSessionId: string,
  dayKey?: string
) {
  const service = await createServiceClient();
  const { error } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'use',
    feature: 'detail_report',
    metadata: getTodayFortunePremiumAccessMetadata(sourceSessionId, readingKey, dayKey),
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

  // [레거시 전 경로] 기존 잔액 보유자 소진용 — 삭제 금지
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
  sourceSessionId: string,
  // 2026-06-05 — KST 일자. 지정 시 당일 unlock 만 reused 처리 + metadata 에 dayKey 포함
  //   → RPC dedup 이 일자별 분리(날짜 바뀌면 재과금). 미지정 시 legacy(영구) 동작.
  dayKey?: string
): Promise<DetailReportUnlockResult> {
  if (await hasTodayFortunePremiumAccess(userId, sourceSessionId, dayKey)) {
    return {
      success: true,
      remaining: await getRemainingCredits(userId),
      reused: true,
    };
  }

  // [멤버십 게이트] 전 앞에 삽입: premium 무제한 / plus 월쿼터 소진
  const tier = await getMemberTier(userId); // 'premium' | 'plus' | null
  if (tier) {
    const limit = MEMBER_QUOTAS[tier].detailMonthly; // null = 무제한(premium)
    const granted =
      limit === null
        ? true
        : await consumeMemberBenefit(userId, MEMBER_BENEFIT_KEYS.detailMonthly.benefit, monthlyPeriodKey(), limit);
    if (granted) {
      await recordTodayFortunePremiumAccess(userId, readingKey, sourceSessionId, dayKey);
      return { success: true, remaining: await getRemainingCredits(userId), reused: false, viaMembership: true };
    }
    // plus 한도 초과 → 아래 레거시 전/페이월로 폴스루
  }

  const accessMetadata = getTodayFortunePremiumAccessMetadata(sourceSessionId, readingKey, dayKey);
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

  await recordTodayFortunePremiumAccess(userId, readingKey, sourceSessionId, dayKey);

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
