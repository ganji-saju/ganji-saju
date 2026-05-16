import { NextRequest, NextResponse } from 'next/server';
import { resolveReading } from '@/lib/saju/readings';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { toSlug } from '@/lib/saju/pillars';
import { createClient } from '@/lib/supabase/server';
import { getUserProfileById } from '@/lib/profile';
import { resolveMoonlightCounselor } from '@/lib/counselors';
import {
  hasDetailReportAccess,
  hasTodayFortunePremiumAccess,
  unlockTodayFortunePremium,
} from '@/lib/credits/detail-report-access';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import {
  buildTodayDetailScopeKey,
  getTasteProductEntitlement,
} from '@/lib/product-entitlements';
import { resolveTodayFortuneUnlockAccess } from './route-helpers';

export const runtime = 'nodejs';

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const sourceSessionId = payload ? readString(payload, 'sourceSessionId') : '';

  if (!sourceSessionId) {
    return NextResponse.json({ error: '열어볼 오늘 결과가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const reading = await resolveReading(sourceSessionId);
  if (!reading) {
    return NextResponse.json({ error: '오늘 결과를 다시 불러오지 못했습니다.' }, { status: 404 });
  }

  if (reading.userId && reading.userId !== user.id) {
    return NextResponse.json({ error: '본인의 결과만 열 수 있습니다.' }, { status: 403 });
  }

  const concernId = normalizeConcernId(payload?.concernId);
  const profile = await getUserProfileById(user.id);
  const counselorId = resolveMoonlightCounselor(payload?.counselorId, profile.preferredCounselor);

  // 2026-05-17 새로고침 회귀 fix — 자동 POST /api/today-fortune/unlock 이 mount
  //   마다 호출되는데 기존 idempotency 가 `today_fortune_premium_access` (sourceSessionId)
  //   만 봤음. 같은 reading 의 1코인 결제로 저장된 `detail_report_access` (readingKey)
  //   row 가 있어도 매치 안 돼 새로고침마다 deduct. PR #192 (entitlement API 같은 패턴)
  //   와 동일 fallback — 3 path 어느 한쪽이라도 access 있으면 deduct skip.
  const readingKey = toSlug(reading.input);
  const accessSource = await resolveTodayFortuneUnlockAccess(
    user.id,
    {
      sourceSessionId,
      readingKey,
      scopeKey: buildTodayDetailScopeKey(sourceSessionId),
    },
    {
      getTodayDetailEntitlement: (userId, scopeKey) =>
        getTasteProductEntitlement(userId, 'today-detail', scopeKey),
      hasTodayFortunePremiumAccess,
      hasDetailReportAccess,
    },
  );

  const access = accessSource
    ? { success: true, remaining: null, reused: true }
    : await unlockTodayFortunePremium(user.id, readingKey, sourceSessionId);

  if (!access.success) {
    return NextResponse.json({ error: '코인이 부족합니다.', remaining: access.remaining }, { status: 402 });
  }

  // 2026-05-15: 자세히 보기를 누른 "오늘" 일진이 반영되도록 sajuData 를 현재 시점으로
  // 재계산. 저장된 reading.sajuData 는 가입/최초 풀이 시점의 calculatedAt 을 들고 있어
  // 매일 같은 일진/시드를 만들어버렸음. grounding·kasiComparison 은 출생 정보 기반이라
  // 재사용해도 무방.
  const todaySajuData = calculateSajuDataV1(reading.input);

  const freeResult = buildTodayFortuneFreeResult(reading.input, todaySajuData, {
    concernId,
    sourceSessionId,
    calendarType: 'solar',
    timeRule: 'standard',
    counselorId,
    grounding: reading.grounding,
    kasiComparison: reading.kasiComparison,
  });
  const result = buildTodayFortunePremiumResult(
    reading.input,
    todaySajuData,
    concernId,
    reading.grounding,
    reading.kasiComparison
  );

  return NextResponse.json({
    ok: true,
    freeResult,
    result,
    remaining: access.remaining,
    access:
      accessSource === 'taste-product'
        ? 'purchased'
        : accessSource || access.reused
          ? 'reused'
          : 'charged',
    counselorId,
  });
}
