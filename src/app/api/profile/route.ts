import { NextRequest, NextResponse } from 'next/server';
import { normalizeMoonlightCounselor } from '@/lib/counselors';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import {
  isMissingBirthLocationColumnError,
  isMissingBirthMinuteColumnError,
  isMissingBirthRuleColumnError,
  isMissingFamilyProfilesTableError,
  isMissingPreferredCounselorColumnError,
  upsertProfile,
  upsertProfileWithClient,
} from '@/lib/profile';
import type { SolarTimeMode } from '@/lib/saju/types';
import type {
  UnifiedCalendarType,
  UnifiedTimeRule,
} from '@/lib/saju/unified-birth-entry';
import { parseProfile } from './route-helpers';

const PROFILE_SELECT =
  'display_name, birth_year, birth_month, birth_day, birth_hour, gender, note';
const PROFILE_SELECT_WITH_MINUTE =
  'display_name, birth_year, birth_month, birth_day, birth_hour, birth_minute, gender, note';
const PROFILE_SELECT_WITH_LOCATION =
  'display_name, birth_year, birth_month, birth_day, birth_hour, gender, note, birth_location_code, birth_location_label, birth_latitude, birth_longitude, solar_time_mode';
const PROFILE_SELECT_FULL =
  'display_name, birth_year, birth_month, birth_day, birth_hour, birth_minute, gender, note, birth_location_code, birth_location_label, birth_latitude, birth_longitude, solar_time_mode';
const PROFILE_SELECT_WITH_BIRTH_RULES =
  'display_name, birth_year, birth_month, birth_day, birth_hour, birth_minute, gender, note, birth_location_code, birth_location_label, birth_latitude, birth_longitude, solar_time_mode, birth_calendar_type, birth_time_rule';
const PROFILE_SELECT_WITH_COUNSELOR =
  'display_name, birth_year, birth_month, birth_day, birth_hour, birth_minute, gender, note, birth_location_code, birth_location_label, birth_latitude, birth_longitude, solar_time_mode, birth_calendar_type, birth_time_rule, preferred_counselor';
const FAMILY_PROFILE_SELECT =
  'id, label, relationship, birth_year, birth_month, birth_day, birth_hour, gender, note, created_at';
const FAMILY_PROFILE_SELECT_WITH_MINUTE =
  'id, label, relationship, birth_year, birth_month, birth_day, birth_hour, birth_minute, gender, note, created_at';
const FAMILY_PROFILE_SELECT_WITH_LOCATION =
  'id, label, relationship, birth_year, birth_month, birth_day, birth_hour, gender, note, created_at, birth_location_code, birth_location_label, birth_latitude, birth_longitude, solar_time_mode';
const FAMILY_PROFILE_SELECT_FULL =
  'id, label, relationship, birth_year, birth_month, birth_day, birth_hour, birth_minute, gender, note, created_at, birth_location_code, birth_location_label, birth_latitude, birth_longitude, solar_time_mode';
const FAMILY_PROFILE_SELECT_WITH_BIRTH_RULES =
  'id, label, relationship, birth_year, birth_month, birth_day, birth_hour, birth_minute, gender, note, created_at, birth_location_code, birth_location_label, birth_latitude, birth_longitude, solar_time_mode, birth_calendar_type, birth_time_rule';

type ProfileRow = {
  display_name?: string | null;
  birth_calendar_type?: UnifiedCalendarType | null;
  birth_time_rule?: UnifiedTimeRule | null;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  birth_hour?: number | null;
  birth_minute?: number | null;
  birth_location_code?: string | null;
  birth_location_label?: string | null;
  birth_latitude?: number | null;
  birth_longitude?: number | null;
  solar_time_mode?: SolarTimeMode | null;
  preferred_counselor?: 'male' | 'female' | null;
  gender?: 'male' | 'female' | null;
  note?: string | null;
};

type FamilyProfileRow = ProfileRow & {
  id: string;
  label: string;
  relationship: string;
  created_at: string;
};

function deriveStoredSolarTimeMode(row: Pick<
  ProfileRow,
  | 'birth_time_rule'
  | 'birth_location_code'
  | 'birth_location_label'
  | 'birth_latitude'
  | 'birth_longitude'
  | 'solar_time_mode'
>) {
  const hasLocation = Boolean(
    row.birth_location_code ||
      row.birth_location_label ||
      row.birth_latitude !== null ||
      row.birth_longitude !== null
  );

  if (row.birth_time_rule === 'trueSolarTime' && hasLocation) {
    return 'longitude' as const;
  }

  return row.solar_time_mode === 'longitude' ? ('longitude' as const) : ('standard' as const);
}

async function loadWithProfileSelectFallback<T>(
  loader: (columns: string) => PromiseLike<{ data: T | null; error: unknown }>,
  selectCandidates: string[]
) {
  let lastResponse: { data: T | null; error: unknown } | null = null;

  for (const columns of selectCandidates) {
    const response = await loader(columns);
    lastResponse = response;

    if (
      response.error &&
      (isMissingBirthMinuteColumnError(response.error) ||
        isMissingBirthLocationColumnError(response.error) ||
        isMissingBirthRuleColumnError(response.error) ||
        isMissingPreferredCounselorColumnError(response.error))
    ) {
      continue;
    }

    return response;
  }

  return lastResponse!;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message ?? '알 수 없는 오류가 발생했습니다.');
  }

  return '알 수 없는 오류가 발생했습니다.';
}

export async function GET() {
  if (!hasSupabaseServerEnv) {
    return NextResponse.json({
      authenticated: false,
      profile: null,
      familyProfiles: [],
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      profile: null,
      familyProfiles: [],
    });
  }

  const loadProfile = (columns: string) =>
    supabase
      .from('profiles')
      .select(columns)
      .eq('user_id', user.id)
      .maybeSingle();

  const loadFamilyProfiles = (columns: string) =>
    supabase
      .from('family_profiles')
      .select(columns)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

  const profileResponse = await loadWithProfileSelectFallback(loadProfile, [
    PROFILE_SELECT_WITH_COUNSELOR,
    PROFILE_SELECT_WITH_BIRTH_RULES,
    PROFILE_SELECT_FULL,
    PROFILE_SELECT_WITH_LOCATION,
    PROFILE_SELECT_WITH_MINUTE,
    PROFILE_SELECT,
  ]);

  const familyResponse = await loadWithProfileSelectFallback(loadFamilyProfiles, [
    FAMILY_PROFILE_SELECT_WITH_BIRTH_RULES,
    FAMILY_PROFILE_SELECT_FULL,
    FAMILY_PROFILE_SELECT_WITH_LOCATION,
    FAMILY_PROFILE_SELECT_WITH_MINUTE,
    FAMILY_PROFILE_SELECT,
  ]);

  if (profileResponse.error) {
    return NextResponse.json({ error: getErrorMessage(profileResponse.error) }, { status: 500 });
  }

  if (familyResponse.error && !isMissingFamilyProfilesTableError(familyResponse.error)) {
    return NextResponse.json({ error: getErrorMessage(familyResponse.error) }, { status: 500 });
  }

  const profile = profileResponse.data as ProfileRow | null;
  const familyProfiles = (familyResponse.data ?? []) as unknown as FamilyProfileRow[];

  return NextResponse.json({
    authenticated: true,
    profile: {
      displayName: profile?.display_name ?? '',
      calendarType: profile?.birth_calendar_type === 'lunar' ? 'lunar' : 'solar',
      timeRule:
        profile?.birth_time_rule === 'trueSolarTime' ||
        profile?.birth_time_rule === 'nightZi' ||
        profile?.birth_time_rule === 'earlyZi'
          ? profile.birth_time_rule
          : 'standard',
      birthYear: profile?.birth_year ?? null,
      birthMonth: profile?.birth_month ?? null,
      birthDay: profile?.birth_day ?? null,
      birthHour: profile?.birth_hour ?? null,
      birthMinute: profile?.birth_minute ?? null,
      birthLocationCode: profile?.birth_location_code ?? null,
      birthLocationLabel: profile?.birth_location_label ?? '',
      birthLatitude: profile?.birth_latitude ?? null,
      birthLongitude: profile?.birth_longitude ?? null,
      solarTimeMode: deriveStoredSolarTimeMode({
        birth_time_rule: profile?.birth_time_rule ?? null,
        birth_location_code: profile?.birth_location_code ?? null,
        birth_location_label: profile?.birth_location_label ?? null,
        birth_latitude: profile?.birth_latitude ?? null,
        birth_longitude: profile?.birth_longitude ?? null,
        solar_time_mode: profile?.solar_time_mode ?? null,
      }),
      preferredCounselor: normalizeMoonlightCounselor(profile?.preferred_counselor),
      gender: profile?.gender ?? null,
      note: profile?.note ?? '',
    },
    familyProfiles: familyResponse.error && isMissingFamilyProfilesTableError(familyResponse.error)
      ? []
      : familyProfiles.map((profile) => ({
          id: profile.id,
          label: profile.label,
          relationship: profile.relationship,
          calendarType: profile.birth_calendar_type === 'lunar' ? 'lunar' : 'solar',
          timeRule:
            profile.birth_time_rule === 'trueSolarTime' ||
            profile.birth_time_rule === 'nightZi' ||
            profile.birth_time_rule === 'earlyZi'
              ? profile.birth_time_rule
              : 'standard',
          birthYear: profile.birth_year ?? null,
          birthMonth: profile.birth_month ?? null,
          birthDay: profile.birth_day ?? null,
          birthHour: profile.birth_hour ?? null,
          birthMinute: profile.birth_minute ?? null,
          birthLocationCode: profile.birth_location_code ?? null,
          birthLocationLabel: profile.birth_location_label ?? '',
          birthLatitude: profile.birth_latitude ?? null,
          birthLongitude: profile.birth_longitude ?? null,
          solarTimeMode: deriveStoredSolarTimeMode(profile),
          gender: profile.gender ?? null,
          note: profile.note ?? '',
          createdAt: profile.created_at,
        })) ?? [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const profile = parseProfile(await req.json().catch(() => null));
  if (!profile) {
    return NextResponse.json({ error: '프로필 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    if (hasSupabaseServiceEnv) {
      await upsertProfile(user.id, profile);
    } else {
      await upsertProfileWithClient(user.id, profile, supabase);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}
