import { NextRequest, NextResponse } from 'next/server';
import { resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { createClient } from '@/lib/supabase/server';
import { getUserProfileById } from '@/lib/profile';
import { resolveMoonlightCounselor } from '@/lib/counselors';
import { unlockTodayFortunePremium } from '@/lib/credits/detail-report-access';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import {
  buildTodayDetailScopeKey,
  getTasteProductEntitlement,
} from '@/lib/product-entitlements';

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
  const todayDetailEntitlement = await getTasteProductEntitlement(
    user.id,
    'today-detail',
    buildTodayDetailScopeKey(sourceSessionId)
  );
  const access = todayDetailEntitlement
    ? { success: true, remaining: null, reused: true }
    : await unlockTodayFortunePremium(user.id, toSlug(reading.input), sourceSessionId);

  if (!access.success) {
    return NextResponse.json({ error: '코인이 부족합니다.', remaining: access.remaining }, { status: 402 });
  }

  const freeResult = buildTodayFortuneFreeResult(reading.input, reading.sajuData, {
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
    reading.sajuData,
    concernId,
    reading.grounding,
    reading.kasiComparison
  );

  return NextResponse.json({
    ok: true,
    freeResult,
    result,
    remaining: access.remaining,
    access: todayDetailEntitlement ? 'purchased' : access.reused ? 'reused' : 'charged',
    counselorId,
  });
}
