import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';
// 2026-06-21 보안(P1) — 비인증 LLM 비용 증폭 + 페이월 우회 차단.
import { createClient } from '@/lib/supabase/server';
import { resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { getManagedSubscription } from '@/lib/subscription';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { buildYearCoreScopeKey } from '@/lib/payments/product-scope';

export const runtime = 'nodejs';
export const maxDuration = 75;

interface InterpretYearlyRequest {
  readingId: string;
  targetYear?: number;
  regenerate?: boolean;
  counselorId?: MoonlightCounselorId;
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getCurrentKoreaYear() {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date());
  const parsed = Number.parseInt(formatted, 10);

  return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
}

function parseTargetYear(value: unknown) {
  const year =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : getCurrentKoreaYear();

  return Number.isInteger(year) && year >= 1900 && year <= 2100
    ? year
    : getCurrentKoreaYear();
}

function parseInterpretYearlyRequest(payload: unknown): InterpretYearlyRequest | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const readingId = readString(data, 'readingId');
  if (!readingId) return null;

  return {
    readingId,
    targetYear: parseTargetYear(data.targetYear),
    regenerate: data.regenerate === true,
    counselorId: normalizeMoonlightCounselor(data.counselorId) ?? undefined,
  };
}

export async function POST(req: NextRequest) {
  const parsed = parseInterpretYearlyRequest(await req.json().catch(() => null));

  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: 'readingId가 필요합니다.' },
      { status: 400 }
    );
  }

  // 2026-06-21 보안(P1) — 인증 + 소유권 + '올해 흐름' 이용권(평생/구독/올해핵심 3-way)
  //   게이트. premium page 의 yearlyAccessLabel 해석(평생·plus/premium 구독·year-core)과 동일.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: '올해 흐름 풀이는 로그인 후 열람할 수 있습니다.' },
      { status: 401 }
    );
  }

  const reading = await resolveReading(parsed.readingId);
  if (!reading) {
    return NextResponse.json(
      { ok: false, error: '사주 결과를 찾지 못했습니다.' },
      { status: 404 }
    );
  }
  if (reading.userId && reading.userId !== user.id) {
    return NextResponse.json(
      { ok: false, error: '본인의 결과만 열 수 있습니다.' },
      { status: 403 }
    );
  }

  const readingKey = toSlug(reading.input);
  const targetYear = parsed.targetYear ?? getCurrentKoreaYear();
  const [lifetime, subscription, yearCore] = await Promise.all([
    getLifetimeReportEntitlement(user.id, readingKey, [parsed.readingId]),
    getManagedSubscription(user.id),
    getTasteProductEntitlement(
      user.id,
      'year-core',
      buildYearCoreScopeKey(readingKey, targetYear)
    ),
  ]);
  const subscriptionUnlocks =
    subscription?.status === 'active' &&
    (subscription.plan === 'plus_monthly' || subscription.plan === 'premium_monthly');
  const hasYearlyAccess = Boolean(lifetime) || Boolean(subscriptionUnlocks) || Boolean(yearCore);
  if (!hasYearlyAccess) {
    return NextResponse.json(
      { ok: false, error: '올해 흐름 풀이 이용권이 필요합니다.' },
      { status: 403 }
    );
  }

  const response = await generateYearlyInterpretation({
    readingIdentifier: parsed.readingId,
    targetYear,
    regenerate: parsed.regenerate,
    counselorId: parsed.counselorId,
  });

  if (!response) {
    return NextResponse.json(
      { ok: false, error: '사주 결과를 찾지 못했습니다.' },
      { status: 404 }
    );
  }

  return NextResponse.json(response);
}
