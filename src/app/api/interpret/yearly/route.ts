import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import { getCurrentKoreaYear, parseTargetYear, readString } from '@/lib/api-utils';
import { generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';

export const runtime = 'nodejs';
export const maxDuration = 75;

interface InterpretYearlyRequest {
  readingId: string;
  targetYear?: number;
  regenerate?: boolean;
  counselorId?: MoonlightCounselorId;
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

  const response = await generateYearlyInterpretation({
    readingIdentifier: parsed.readingId,
    targetYear: parsed.targetYear ?? getCurrentKoreaYear(),
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
