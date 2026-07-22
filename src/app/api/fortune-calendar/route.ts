import { NextRequest, NextResponse } from 'next/server';
import { buildFortuneCalendarMonth } from '@/domain/saju/report';
import { hasFortuneCalendarMonthAccess } from '@/lib/credits/calendar-access';
import { getFeatureCost } from '@/lib/credits/deduct';
import { hasMonthlyCalendarForReading } from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
// 2026-07-07 — 달력 iljin 메시지 "[이름] 님" 이 '선생님' fallback 으로 새지 않도록
//   reading.input(이름 없음)에 표시 이름 보강. toSlug 은 원본 그대로 사용(슬러그 안정).
import { resolveNamedReadingInput } from '@/lib/today-fortune/result-snapshots';
import { createClient, hasSupabaseServerEnv, hasSupabaseServiceEnv } from '@/lib/supabase/server';

type AccessKind = 'lifetime' | 'month_unlock' | 'product_unlock' | 'locked';

function getCurrentKoreaMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
  };
}

function parseYear(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null;
}

function parseMonth(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

async function resolveCalendarAccess(
  readingKey: string,
  legacyReadingKey: string,
  targetYear: number,
  month: number
): Promise<{
  access: AccessKind;
  userId: string | null;
}> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return { access: 'locked', userId: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { access: 'locked', userId: null };
  }

  const entitlement = await getLifetimeReportEntitlement(user.id, readingKey, [legacyReadingKey]);
  if (entitlement) {
    return { access: 'lifetime', userId: user.id };
  }

  const hasMonthlyProduct = await hasMonthlyCalendarForReading(
    user.id,
    readingKey,
    targetYear,
    month
  );
  if (hasMonthlyProduct) {
    return { access: 'product_unlock', userId: user.id };
  }

  const hasMonthAccess = await hasFortuneCalendarMonthAccess(
    user.id,
    readingKey,
    targetYear,
    month
  );

  return {
    access: hasMonthAccess ? 'month_unlock' : 'locked',
    userId: user.id,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug')?.trim() ?? '';
  const current = getCurrentKoreaMonth();
  const targetYear = parseYear(searchParams.get('targetYear')) ?? current.year;
  const month = parseMonth(searchParams.get('month')) ?? current.month;

  if (!slug) {
    return NextResponse.json({ error: '사주 결과 식별자가 필요합니다.' }, { status: 400 });
  }

  const reading = await resolveReading(slug);
  if (!reading) {
    return NextResponse.json({ error: '사주 결과를 찾지 못했습니다.' }, { status: 404 });
  }

  const readingKey = toSlug(reading.input);
  const { access, userId } = await resolveCalendarAccess(readingKey, slug, targetYear, month);

  if (reading.userId && userId && reading.userId !== userId) {
    return NextResponse.json({ error: '본인의 결과만 열 수 있습니다.' }, { status: 403 });
  }

  if (access === 'locked') {
    return NextResponse.json({
      ok: true,
      access,
      targetYear,
      month,
      monthLabel: `${targetYear}년 ${month}월`,
      coinCost: getFeatureCost('calendar'),
      hasLifetimeAccess: false,
      report: null,
    });
  }

  const namedInput = await resolveNamedReadingInput(reading.input, reading.userId);
  const report = buildFortuneCalendarMonth(namedInput, reading.sajuData, targetYear, month);

  return NextResponse.json({
    ok: true,
    access,
    targetYear,
    month,
    monthLabel: report.monthLabel,
    coinCost: 0,
    hasLifetimeAccess: access === 'lifetime',
    report,
  });
}
