import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { createClient } from '@/lib/supabase/server';
import { generateLifetimeInterpretation } from '@/server/ai/saju-lifetime-service';

export const runtime = 'nodejs';
export const maxDuration = 75;

interface InterpretLifetimeRequest {
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

function parseInterpretLifetimeRequest(payload: unknown): InterpretLifetimeRequest | null {
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
  const parsed = parseInterpretLifetimeRequest(await req.json().catch(() => null));

  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: 'readingId가 필요합니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: '깊은 사주풀이는 로그인 후 열람할 수 있습니다.' },
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

  const readingKey = toSlug(reading.input);
  const entitlement = await getLifetimeReportEntitlement(user.id, readingKey, [parsed.readingId]);

  if (!entitlement) {
    return NextResponse.json(
      { ok: false, error: '평생 소장권 사용자만 전체 리포트를 열람할 수 있습니다.' },
      { status: 403 }
    );
  }

  const response = await generateLifetimeInterpretation({
    readingIdentifier: parsed.readingId,
    targetYear: parsed.targetYear ?? getCurrentKoreaYear(),
    regenerate: parsed.regenerate,
    counselorId: parsed.counselorId,
    readingRecord: reading,
  });

  if (!response) {
    return NextResponse.json(
      { ok: false, error: '사주 결과를 찾지 못했습니다.' },
      { status: 404 }
    );
  }

  return NextResponse.json(response);
}
