import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createFamilyProfile,
  deleteFamilyProfile,
  updateFamilyProfile,
  type FamilyProfileInput,
} from '@/lib/profile';
import type { SolarTimeMode } from '@/lib/saju/types';
import type { UnifiedCalendarType, UnifiedTimeRule } from '@/lib/saju/unified-birth-entry';

function parseOptionalInt(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function parseOptionalNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readBirthPayloadValue(
  data: Record<string, unknown>,
  primaryKey: string,
  unifiedKey: string
) {
  if (data[primaryKey] !== undefined) return data[primaryKey];
  return data[unifiedKey];
}

function parseBirthLocationFields(
  data: Record<string, unknown>,
  timeRule: UnifiedTimeRule
) {
  const code = readString(data.birthLocationCode);
  const label = readString(data.birthLocationLabel);
  const latitude = parseOptionalNumber(data.birthLatitude, -90, 90);
  const longitude = parseOptionalNumber(data.birthLongitude, -180, 180);
  const hasLocationInput = Boolean(code || label || data.birthLatitude || data.birthLongitude);

  if (!hasLocationInput) {
    return {
      ok: true as const,
      birthLocationCode: null,
      birthLocationLabel: '',
      birthLatitude: null,
      birthLongitude: null,
      solarTimeMode: 'standard' as SolarTimeMode,
    };
  }

  if (!code || !label || latitude === null || longitude === null) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    birthLocationCode: code,
    birthLocationLabel: label,
    birthLatitude: latitude,
    birthLongitude: longitude,
    solarTimeMode:
      timeRule === 'trueSolarTime' ? ('longitude' as const) : ('standard' as const),
  };
}

function parseFamilyProfile(
  payload: unknown
): FamilyProfileInput | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const label = typeof data.label === 'string' ? data.label.trim() : '';
  const relationship =
    typeof data.relationship === 'string' ? data.relationship.trim() : '';
  const note = typeof data.note === 'string' ? data.note.trim() : '';
  const gender =
    data.gender === 'male' || data.gender === 'female' ? data.gender : null;
  const calendarType =
    data.calendarType === 'lunar' ? 'lunar' : data.calendarType === 'solar' ? 'solar' : 'solar';
  const timeRule =
    data.timeRule === 'trueSolarTime' ||
    data.timeRule === 'nightZi' ||
    data.timeRule === 'earlyZi'
      ? data.timeRule
      : 'standard';
  const birthLocation = parseBirthLocationFields(data, timeRule);
  const unknownBirthTime = data.unknownBirthTime === true;
  const birthYearValue = readBirthPayloadValue(data, 'birthYear', 'year');
  const birthMonthValue = readBirthPayloadValue(data, 'birthMonth', 'month');
  const birthDayValue = readBirthPayloadValue(data, 'birthDay', 'day');
  const birthHourValue = readBirthPayloadValue(data, 'birthHour', 'hour');
  const birthMinuteValue = readBirthPayloadValue(data, 'birthMinute', 'minute');

  if (!label || !relationship) {
    return null;
  }

  const birthYear =
    birthYearValue === '' || birthYearValue === undefined || birthYearValue === null
      ? null
      : parseOptionalInt(birthYearValue, 1900, new Date().getFullYear());
  const birthMonth =
    birthMonthValue === '' || birthMonthValue === undefined || birthMonthValue === null
      ? null
      : parseOptionalInt(birthMonthValue, 1, 12);
  const birthDay =
    birthDayValue === '' || birthDayValue === undefined || birthDayValue === null
      ? null
      : parseOptionalInt(birthDayValue, 1, 31);
  const birthHour =
    unknownBirthTime || birthHourValue === '' || birthHourValue === undefined || birthHourValue === null
      ? null
      : parseOptionalInt(birthHourValue, 0, 23);
  const birthMinute =
    unknownBirthTime || birthMinuteValue === '' || birthMinuteValue === undefined || birthMinuteValue === null
      ? null
      : parseOptionalInt(birthMinuteValue, 0, 59);

  if (
    (birthYearValue !== '' && birthYearValue !== undefined && birthYearValue !== null && birthYear === null) ||
    (birthMonthValue !== '' && birthMonthValue !== undefined && birthMonthValue !== null && birthMonth === null) ||
    (birthDayValue !== '' && birthDayValue !== undefined && birthDayValue !== null && birthDay === null) ||
    (birthHourValue !== '' && birthHourValue !== undefined && birthHourValue !== null && birthHour === null) ||
    (birthMinuteValue !== '' && birthMinuteValue !== undefined && birthMinuteValue !== null && birthMinute === null) ||
    (birthHour === null && birthMinute !== null) ||
    !birthLocation.ok
  ) {
    return null;
  }

  return {
    label,
    relationship,
    calendarType: calendarType as UnifiedCalendarType,
    timeRule: timeRule as UnifiedTimeRule,
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
    birthLocationCode: birthLocation.birthLocationCode,
    birthLocationLabel: birthLocation.birthLocationLabel,
    birthLatitude: birthLocation.birthLatitude,
    birthLongitude: birthLocation.birthLongitude,
    solarTimeMode: birthLocation.solarTimeMode,
    gender,
    note,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const profile = parseFamilyProfile(await req.json().catch(() => null));
  if (!profile) {
    return NextResponse.json(
      { error: '가족 프로필 정보가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  try {
    const id = await createFamilyProfile(user.id, profile);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '가족 프로필을 저장하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const id =
    payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).id === 'string'
      ? ((payload as Record<string, unknown>).id as string)
      : '';
  const profile = parseFamilyProfile(payload);

  if (!id || !profile) {
    return NextResponse.json(
      { error: '수정할 가족 프로필 정보가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  try {
    await updateFamilyProfile(user.id, id, profile);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '가족 프로필을 수정하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const id =
    payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).id === 'string'
      ? ((payload as Record<string, unknown>).id as string)
      : '';

  if (!id) {
    return NextResponse.json({ error: '삭제할 프로필이 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const deleted = await deleteFamilyProfile(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: '삭제할 가족 프로필을 찾지 못했습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '가족 프로필을 삭제하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}
