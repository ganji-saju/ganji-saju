import { NextRequest, NextResponse } from 'next/server';
import { buildFortuneCalendarMonth } from '@/domain/saju/report';
import { unlockFortuneCalendarMonth } from '@/lib/credits/calendar-access';
import { getFeatureCost } from '@/lib/credits/deduct';
import { hasMonthlyCalendarForReading } from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
// 2026-07-07 — 달력 iljin 메시지 "[이름] 님" 이 '선생님' fallback 으로 새지 않도록 표시 이름 보강.
import { resolveNamedReadingInput } from '@/lib/today-fortune/result-snapshots';
import { createClient } from '@/lib/supabase/server';

function parseRequest(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
  const targetYear = typeof data.targetYear === 'number' ? data.targetYear : Number(data.targetYear);
  const month = typeof data.month === 'number' ? data.month : Number(data.month);

  if (!slug || !Number.isInteger(targetYear) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;

  return { slug, targetYear, month };
}

export async function POST(req: NextRequest) {
  const parsed = parseRequest(await req.json().catch(() => null));
  if (!parsed) {
    return NextResponse.json({ error: '요청 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const reading = await resolveReading(parsed.slug);
  if (!reading) {
    return NextResponse.json({ error: '사주 결과를 찾지 못했습니다.' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  if (reading.userId && reading.userId !== user.id) {
    return NextResponse.json({ error: '본인의 결과만 열 수 있습니다.' }, { status: 403 });
  }

  const readingKey = toSlug(reading.input);
  const namedInput = await resolveNamedReadingInput(reading.input, reading.userId);

  const entitlement = await getLifetimeReportEntitlement(user.id, readingKey, [parsed.slug]);
  if (entitlement) {
    const report = buildFortuneCalendarMonth(
      namedInput,
      reading.sajuData,
      parsed.targetYear,
      parsed.month
    );

    return NextResponse.json({
      success: true,
      access: 'lifetime',
      remaining: null,
      reused: true,
      coinCost: 0,
      report,
    });
  }

  const hasMonthlyProduct = await hasMonthlyCalendarForReading(
    user.id,
    readingKey,
    parsed.targetYear,
    parsed.month
  );
  if (hasMonthlyProduct) {
    const report = buildFortuneCalendarMonth(
      namedInput,
      reading.sajuData,
      parsed.targetYear,
      parsed.month
    );

    return NextResponse.json({
      success: true,
      access: 'product_unlock',
      remaining: null,
      reused: true,
      coinCost: 0,
      report,
    });
  }

  const result = await unlockFortuneCalendarMonth(
    user.id,
    readingKey,
    parsed.targetYear,
    parsed.month
  );

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error ?? '전이 부족합니다.',
        remaining: result.remaining,
        coinCost: getFeatureCost('calendar'),
      },
      { status: 402 }
    );
  }

  const report = buildFortuneCalendarMonth(
    namedInput,
    reading.sajuData,
    parsed.targetYear,
    parsed.month
  );

  return NextResponse.json({
    success: true,
    access: 'month_unlock',
    remaining: result.remaining,
    reused: result.reused,
    coinCost: getFeatureCost('calendar'),
    report,
  });
}
