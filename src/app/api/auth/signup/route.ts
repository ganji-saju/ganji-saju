import { NextRequest, NextResponse } from 'next/server';
import { getBirthLocationPreset } from '@/lib/saju/birth-location';
import type { UnifiedCalendarType, UnifiedTimeRule } from '@/lib/saju/unified-birth-entry';
import { hasSupabaseServiceEnv, createServiceClient } from '@/lib/supabase/server';
import { upsertProfile, type UserProfile } from '@/lib/profile';

type SignupGender = 'male' | 'female';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseIntInRange(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function parseSignupPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false as const, error: '회원가입 정보를 다시 확인해 주세요.' };
  }

  const data = payload as Record<string, unknown>;
  const email = readString(data.email).toLowerCase();
  const password = readString(data.password);
  const displayName = readString(data.displayName);
  const calendarType: UnifiedCalendarType = data.calendarType === 'lunar' ? 'lunar' : 'solar';
  const timeRule: UnifiedTimeRule =
    data.timeRule === 'trueSolarTime' ||
    data.timeRule === 'nightZi' ||
    data.timeRule === 'earlyZi'
      ? data.timeRule
      : 'standard';
  const gender = data.gender === 'male' || data.gender === 'female' ? data.gender : null;
  const birthYear = parseIntInRange(data.birthYear, 1900, new Date().getFullYear());
  const birthMonth = parseIntInRange(data.birthMonth, 1, 12);
  const birthDay = parseIntInRange(data.birthDay, 1, 31);
  const unknownBirthTime = data.unknownBirthTime === true;
  const birthHour = unknownBirthTime ? null : parseIntInRange(data.birthHour, 0, 23);
  const birthMinute = unknownBirthTime ? null : parseIntInRange(data.birthMinute, 0, 59);
  const birthLocation = getBirthLocationPreset(readString(data.birthLocationCode));

  if (!email.includes('@')) {
    return { ok: false as const, error: '이메일 주소를 확인해 주세요.' };
  }

  if (password.length < 8) {
    return { ok: false as const, error: '비밀번호는 8자 이상으로 입력해 주세요.' };
  }

  if (!displayName) {
    return { ok: false as const, error: '이름 또는 별명을 입력해 주세요.' };
  }

  if (!gender) {
    return { ok: false as const, error: '성별을 선택해 주세요.' };
  }

  if (!birthYear || !birthMonth || !birthDay) {
    return { ok: false as const, error: '생년월일을 모두 선택해 주세요.' };
  }

  if (!unknownBirthTime && birthHour === null) {
    return { ok: false as const, error: '출생시를 선택하거나 시간을 모름으로 표시해 주세요.' };
  }

  if (!birthLocation) {
    return { ok: false as const, error: '출생지를 선택해 주세요.' };
  }

  const profile: UserProfile = {
    displayName,
    calendarType,
    timeRule,
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
    birthLocationCode: birthLocation.code ?? readString(data.birthLocationCode),
    birthLocationLabel: birthLocation.label,
    birthLatitude: birthLocation.latitude,
    birthLongitude: birthLocation.longitude,
    solarTimeMode: timeRule === 'trueSolarTime' ? 'longitude' : 'standard',
    gender: gender as SignupGender,
    note: '',
  };

  return { ok: true as const, email, password, profile };
}

function isExistingUserError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('already') ||
    normalized.includes('registered') ||
    normalized.includes('exists') ||
    normalized.includes('duplicate')
  );
}

export async function POST(req: NextRequest) {
  if (!hasSupabaseServiceEnv) {
    return NextResponse.json(
      { error: '회원가입을 저장할 Supabase 서버 설정이 없습니다.' },
      { status: 500 }
    );
  }

  const parsed = parseSignupPayload(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      display_name: parsed.profile.displayName,
      signup_source: 'dalbit-insaeng-profile-signup',
    },
  });

  if (error || !data.user) {
    const message = error?.message ?? '회원가입을 완료하지 못했습니다.';
    return NextResponse.json(
      {
        error: isExistingUserError(message)
          ? '이미 가입된 이메일입니다. 로그인 탭에서 비밀번호로 로그인해 주세요.'
          : message,
      },
      { status: isExistingUserError(message) ? 409 : 500 }
    );
  }

  try {
    await upsertProfile(data.user.id, parsed.profile);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `계정은 생성됐지만 사주 기본정보를 저장하지 못했습니다. ${error.message}`
            : '계정은 생성됐지만 사주 기본정보를 저장하지 못했습니다.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    userId: data.user.id,
    next: '/saju/new?autoProfile=1',
  });
}
