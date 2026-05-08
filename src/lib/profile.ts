import {
  createClient,
  createServiceClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { requireAccount } from '@/lib/account';
import {
  normalizeMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';
import type { BirthInput, SolarTimeMode } from '@/lib/saju/types';
import type {
  UnifiedCalendarType,
  UnifiedTimeRule,
} from '@/lib/saju/unified-birth-entry';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';

export interface BirthProfileFields {
  calendarType: UnifiedCalendarType;
  timeRule: UnifiedTimeRule;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthHour: number | null;
  birthMinute: number | null;
  birthLocationCode: string | null;
  birthLocationLabel: string;
  birthLatitude: number | null;
  birthLongitude: number | null;
  solarTimeMode: SolarTimeMode;
  gender: 'male' | 'female' | null;
  note: string;
}

export interface UserProfile extends BirthProfileFields {
  displayName: string;
  preferredCounselor?: MoonlightCounselorId | null;
}

export interface FamilyProfile extends BirthProfileFields {
  id: string;
  label: string;
  relationship: string;
  createdAt: string;
}

export type FamilyProfileInput = Omit<FamilyProfile, 'id' | 'createdAt'>;

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
const BIRTH_MINUTE_MIGRATION_ERROR =
  '운영 DB에 출생 분 저장 컬럼이 아직 적용되지 않았습니다. 005_profile_birth_minutes.sql 마이그레이션이 필요합니다.';
const BIRTH_LOCATION_MIGRATION_ERROR =
  '운영 DB에 출생 지역 저장 컬럼이 아직 적용되지 않았습니다. 009_profile_birth_locations.sql 마이그레이션이 필요합니다.';
const BIRTH_RULE_MIGRATION_ERROR =
  '운영 DB에 양력/음력 및 시각 규칙 저장 컬럼이 아직 적용되지 않았습니다. 014_profile_birth_calendar_fields.sql 마이그레이션이 필요합니다.';
const PREFERRED_COUNSELOR_MIGRATION_ERROR =
  '운영 DB에 선생 선택 저장 컬럼이 아직 적용되지 않았습니다. 010_profile_preferred_counselor.sql 마이그레이션이 필요합니다.';

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
  preferred_counselor?: MoonlightCounselorId | null;
  gender?: 'male' | 'female' | null;
  note?: string | null;
};

type FamilyProfileRow = ProfileRow & {
  id: string;
  label: string;
  relationship: string;
  created_at: string;
};

function toNumberOrNull(value: number | null | undefined) {
  return value ?? null;
}

function removeBirthMinute<T extends Record<string, unknown>>(payload: T) {
  const { birth_minute: _birthMinute, ...rest } = payload;
  return rest;
}

function removeBirthLocation<T extends Record<string, unknown>>(payload: T) {
  const {
    birth_location_code: _birthLocationCode,
    birth_location_label: _birthLocationLabel,
    birth_latitude: _birthLatitude,
    birth_longitude: _birthLongitude,
    solar_time_mode: _solarTimeMode,
    ...rest
  } = payload;
  return rest;
}

function removePreferredCounselor<T extends Record<string, unknown>>(payload: T) {
  const { preferred_counselor: _preferredCounselor, ...rest } = payload;
  return rest;
}

function removeBirthRuleFields<T extends Record<string, unknown>>(payload: T) {
  const {
    birth_calendar_type: _birthCalendarType,
    birth_time_rule: _birthTimeRule,
    ...rest
  } = payload;
  return rest;
}

export function isMissingFamilyProfilesTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = 'message' in error ? String(error.message ?? '') : '';

  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('public.family_profiles') ||
    message.includes("relation 'family_profiles' does not exist") ||
    message.includes('relation "family_profiles" does not exist')
  );
}

export function isMissingBirthMinuteColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = 'message' in error ? String(error.message ?? '') : '';
  const details = 'details' in error ? String(error.details ?? '') : '';
  const hint = 'hint' in error ? String(error.hint ?? '') : '';
  const combined = `${message} ${details} ${hint}`;

  return (
    combined.includes('birth_minute') &&
    (code === '42703' ||
      code === 'PGRST204' ||
      combined.includes('column') ||
      combined.includes('schema cache'))
  );
}

export function isMissingBirthLocationColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = 'message' in error ? String(error.message ?? '') : '';
  const details = 'details' in error ? String(error.details ?? '') : '';
  const hint = 'hint' in error ? String(error.hint ?? '') : '';
  const combined = `${message} ${details} ${hint}`;

  return (
    (combined.includes('birth_location') ||
      combined.includes('birth_latitude') ||
      combined.includes('birth_longitude') ||
      combined.includes('solar_time_mode')) &&
    (code === '42703' ||
      code === 'PGRST204' ||
      combined.includes('column') ||
      combined.includes('schema cache'))
  );
}

export function isMissingPreferredCounselorColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = 'message' in error ? String(error.message ?? '') : '';
  const details = 'details' in error ? String(error.details ?? '') : '';
  const hint = 'hint' in error ? String(error.hint ?? '') : '';
  const combined = `${message} ${details} ${hint}`;

  return (
    combined.includes('preferred_counselor') &&
    (code === '42703' ||
      code === 'PGRST204' ||
      combined.includes('column') ||
      combined.includes('schema cache'))
  );
}

export function isMissingBirthRuleColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = 'message' in error ? String(error.message ?? '') : '';
  const details = 'details' in error ? String(error.details ?? '') : '';
  const hint = 'hint' in error ? String(error.hint ?? '') : '';
  const combined = `${message} ${details} ${hint}`;

  return (
    (combined.includes('birth_calendar_type') || combined.includes('birth_time_rule')) &&
    (code === '42703' ||
      code === 'PGRST204' ||
      combined.includes('column') ||
      combined.includes('schema cache'))
  );
}

function hasProfileBirthLocation(profile: BirthProfileFields) {
  return Boolean(
    profile.birthLocationCode ||
      profile.birthLocationLabel ||
      profile.birthLatitude !== null ||
      profile.birthLongitude !== null ||
      profile.solarTimeMode === 'longitude'
  );
}

function hasNonDefaultBirthRules(profile: BirthProfileFields) {
  return profile.calendarType !== 'solar' || profile.timeRule !== 'standard';
}

async function writeProfilePayloadWithFallback<
  T extends Record<string, unknown>,
  R extends { error: unknown },
>(
  profile: BirthProfileFields,
  payload: T,
  write: (payload: T) => PromiseLike<R>
) {
  let currentPayload = payload;
  let response = await write(currentPayload);

  for (let attempt = 0; response.error && attempt < 4; attempt += 1) {
    let nextPayload: Record<string, unknown> | null = null;

    if (isMissingBirthMinuteColumnError(response.error)) {
      if (profile.birthMinute !== null) {
        throw new Error(BIRTH_MINUTE_MIGRATION_ERROR);
      }
      nextPayload = removeBirthMinute(currentPayload);
    }

    if (isMissingBirthLocationColumnError(response.error)) {
      if (hasProfileBirthLocation(profile)) {
        throw new Error(BIRTH_LOCATION_MIGRATION_ERROR);
      }
      nextPayload = removeBirthLocation(nextPayload ?? currentPayload);
    }

    if (isMissingPreferredCounselorColumnError(response.error)) {
      if ('preferred_counselor' in currentPayload && currentPayload.preferred_counselor) {
        throw new Error(PREFERRED_COUNSELOR_MIGRATION_ERROR);
      }
      nextPayload = removePreferredCounselor(nextPayload ?? currentPayload);
    }

    if (isMissingBirthRuleColumnError(response.error)) {
      if (hasNonDefaultBirthRules(profile)) {
        throw new Error(BIRTH_RULE_MIGRATION_ERROR);
      }
      nextPayload = removeBirthRuleFields(nextPayload ?? currentPayload);
    }

    if (!nextPayload) break;

    currentPayload = nextPayload as T;
    response = await write(currentPayload);
  }

  return response;
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

function mapUserProfile(row: ProfileRow | null | undefined): UserProfile {
  return {
    displayName: row?.display_name ?? '',
    preferredCounselor: normalizeMoonlightCounselor(row?.preferred_counselor),
    calendarType: row?.birth_calendar_type === 'lunar' ? 'lunar' : 'solar',
    timeRule:
      row?.birth_time_rule === 'trueSolarTime' ||
      row?.birth_time_rule === 'nightZi' ||
      row?.birth_time_rule === 'earlyZi'
        ? row.birth_time_rule
        : 'standard',
    birthYear: toNumberOrNull(row?.birth_year),
    birthMonth: toNumberOrNull(row?.birth_month),
    birthDay: toNumberOrNull(row?.birth_day),
    birthHour: toNumberOrNull(row?.birth_hour),
    birthMinute: toNumberOrNull(row?.birth_minute),
    birthLocationCode: row?.birth_location_code ?? null,
    birthLocationLabel: row?.birth_location_label ?? '',
    birthLatitude: toNumberOrNull(row?.birth_latitude),
    birthLongitude: toNumberOrNull(row?.birth_longitude),
    solarTimeMode: deriveStoredSolarTimeMode({
      birth_time_rule: row?.birth_time_rule ?? null,
      birth_location_code: row?.birth_location_code ?? null,
      birth_location_label: row?.birth_location_label ?? null,
      birth_latitude: row?.birth_latitude ?? null,
      birth_longitude: row?.birth_longitude ?? null,
      solar_time_mode: row?.solar_time_mode ?? null,
    }),
    gender: row?.gender ?? null,
    note: row?.note ?? '',
  };
}

export function createEmptyUserProfile(): UserProfile {
  return mapUserProfile(null);
}

export function hasCoreBirthProfile(
  profile: BirthProfileFields | null | undefined
): profile is BirthProfileFields & {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
} {
  return Boolean(profile?.birthYear && profile.birthMonth && profile.birthDay);
}

export function toBirthInputFromProfile(
  profile: BirthProfileFields & {
    birthYear: number;
    birthMonth: number;
    birthDay: number;
  }
): BirthInput {
  const profileName =
    'displayName' in profile && typeof profile.displayName === 'string'
      ? profile.displayName
      : 'label' in profile && typeof profile.label === 'string'
        ? profile.label
        : undefined;
  const resolved = resolveUnifiedBirthInput(
    {
      calendarType: profile.calendarType,
      timeRule: profile.timeRule,
      year: String(profile.birthYear),
      month: String(profile.birthMonth),
      day: String(profile.birthDay),
      hour: profile.birthHour === null ? '' : String(profile.birthHour),
      minute: profile.birthMinute === null ? '' : String(profile.birthMinute),
      unknownBirthTime: profile.birthHour === null,
      gender: profile.gender ?? '',
      birthLocationCode: profile.birthLocationCode ?? '',
      birthLocationLabel: profile.birthLocationLabel,
      birthLatitude: profile.birthLatitude === null ? '' : String(profile.birthLatitude),
      birthLongitude: profile.birthLongitude === null ? '' : String(profile.birthLongitude),
    },
    { requireGender: false }
  );

  if (resolved.ok) {
    return {
      ...resolved.input,
      name: profileName?.trim() || undefined,
    };
  }

  const hasBirthLocation =
    Boolean(profile.birthLocationLabel) &&
    profile.birthLatitude !== null &&
    profile.birthLongitude !== null;

  return {
    name: profileName?.trim() || undefined,
    year: profile.birthYear,
    month: profile.birthMonth,
    day: profile.birthDay,
    hour: profile.birthHour ?? undefined,
    minute: profile.birthMinute ?? undefined,
    unknownTime: profile.birthHour === null,
    gender: profile.gender ?? undefined,
    birthLocation: hasBirthLocation
      ? {
          code: profile.birthLocationCode ?? undefined,
          label: profile.birthLocationLabel,
          latitude: profile.birthLatitude!,
          longitude: profile.birthLongitude!,
        }
      : null,
    solarTimeMode:
      hasBirthLocation && profile.timeRule === 'trueSolarTime' ? 'longitude' : 'standard',
  };
}

function mapFamilyProfile(row: FamilyProfileRow): FamilyProfile {
  return {
    id: row.id,
    label: row.label,
    relationship: row.relationship,
    calendarType: row.birth_calendar_type === 'lunar' ? 'lunar' : 'solar',
    timeRule:
      row.birth_time_rule === 'trueSolarTime' ||
      row.birth_time_rule === 'nightZi' ||
      row.birth_time_rule === 'earlyZi'
        ? row.birth_time_rule
        : 'standard',
    birthYear: toNumberOrNull(row.birth_year),
    birthMonth: toNumberOrNull(row.birth_month),
    birthDay: toNumberOrNull(row.birth_day),
    birthHour: toNumberOrNull(row.birth_hour),
    birthMinute: toNumberOrNull(row.birth_minute),
    birthLocationCode: row.birth_location_code ?? null,
    birthLocationLabel: row.birth_location_label ?? '',
    birthLatitude: toNumberOrNull(row.birth_latitude),
    birthLongitude: toNumberOrNull(row.birth_longitude),
    solarTimeMode: deriveStoredSolarTimeMode(row),
    gender: row.gender ?? null,
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

export async function getProfileSettingsData(redirectPath: string) {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return {
      user: {
        id: 'local-preview',
        email: 'preview@dalbit.local',
      },
      profile: {
        displayName: '',
        preferredCounselor: null,
        calendarType: 'solar',
        timeRule: 'standard',
        birthYear: null,
        birthMonth: null,
        birthDay: null,
        birthHour: null,
        birthMinute: null,
        birthLocationCode: null,
        birthLocationLabel: '',
        birthLatitude: null,
        birthLongitude: null,
        solarTimeMode: 'standard',
        gender: null,
        note: '',
      } satisfies UserProfile,
      familyProfiles: [] satisfies FamilyProfile[],
    };
  }

  const { supabase, user } = await requireAccount(redirectPath);

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
    throw new Error(getErrorMessage(profileResponse.error));
  }

  const profile = mapUserProfile(profileResponse.data as ProfileRow | null);

  if (familyResponse.error && !isMissingFamilyProfilesTableError(familyResponse.error)) {
    throw new Error(getErrorMessage(familyResponse.error));
  }

  const familyProfiles: FamilyProfile[] =
    familyResponse.error && isMissingFamilyProfilesTableError(familyResponse.error)
      ? []
      : ((familyResponse.data ?? []) as unknown as FamilyProfileRow[]).map((item) =>
          mapFamilyProfile(item)
        );

  return {
    user: {
      id: user.id,
      email: user.email ?? '',
    },
    profile,
    familyProfiles,
  };
}

export async function getUserProfileById(userId: string): Promise<UserProfile> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return createEmptyUserProfile();
  }

  const service = await createServiceClient();
  const loadProfile = (columns: string) =>
    service
      .from('profiles')
      .select(columns)
      .eq('user_id', userId)
      .maybeSingle();

  const profileResponse = await loadWithProfileSelectFallback(loadProfile, [
    PROFILE_SELECT_WITH_COUNSELOR,
    PROFILE_SELECT_WITH_BIRTH_RULES,
    PROFILE_SELECT_FULL,
    PROFILE_SELECT_WITH_LOCATION,
    PROFILE_SELECT_WITH_MINUTE,
    PROFILE_SELECT,
  ]);

  if (profileResponse.error) {
    throw new Error(getErrorMessage(profileResponse.error));
  }

  return mapUserProfile(profileResponse.data as ProfileRow | null);
}

export async function getOptionalSignedInProfile(): Promise<UserProfile | null> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const profile = await getUserProfileById(user.id);
    return hasCoreBirthProfile(profile) ? profile : null;
  } catch {
    return null;
  }
}

type ProfileWriterClient = Pick<
  Awaited<ReturnType<typeof createClient>> | Awaited<ReturnType<typeof createServiceClient>>,
  'from'
>;

function buildProfilePayload(userId: string, profile: UserProfile) {
  const payload = {
    user_id: userId,
    display_name: profile.displayName || null,
    birth_calendar_type: profile.calendarType,
    birth_time_rule: profile.timeRule,
    birth_year: profile.birthYear,
    birth_month: profile.birthMonth,
    birth_day: profile.birthDay,
    birth_hour: profile.birthHour,
    birth_minute: profile.birthMinute,
    birth_location_code: profile.birthLocationCode,
    birth_location_label: profile.birthLocationLabel || null,
    birth_latitude: profile.birthLatitude,
    birth_longitude: profile.birthLongitude,
    solar_time_mode: profile.solarTimeMode,
    gender: profile.gender,
    note: profile.note || null,
    updated_at: new Date().toISOString(),
  };

  return payload;
}

export async function upsertProfileWithClient(
  userId: string,
  profile: UserProfile,
  client: ProfileWriterClient
) {
  const payload = buildProfilePayload(userId, profile);

  const response = await writeProfilePayloadWithFallback(profile, payload, (nextPayload) =>
    client.from('profiles').upsert(nextPayload)
  );

  if (response.error) {
    throw new Error(getErrorMessage(response.error));
  }
}

export async function upsertProfile(userId: string, profile: UserProfile) {
  const service = await createServiceClient();
  await upsertProfileWithClient(userId, profile, service);
}

export async function updatePreferredCounselor(
  userId: string,
  preferredCounselor: MoonlightCounselorId
) {
  const service = await createServiceClient();
  const payload = {
    user_id: userId,
    preferred_counselor: preferredCounselor,
    updated_at: new Date().toISOString(),
  };

  let response = await service.from('profiles').upsert(payload);

  if (response.error && isMissingPreferredCounselorColumnError(response.error)) {
    return { persisted: false as const };
  }

  if (response.error) {
    throw new Error(getErrorMessage(response.error));
  }

  return { persisted: true as const };
}

export async function createFamilyProfile(
  userId: string,
  profile: FamilyProfileInput
) {
  const service = await createServiceClient();

  const payload = {
    user_id: userId,
    label: profile.label,
    relationship: profile.relationship,
    birth_calendar_type: profile.calendarType,
    birth_time_rule: profile.timeRule,
    birth_year: profile.birthYear,
    birth_month: profile.birthMonth,
    birth_day: profile.birthDay,
    birth_hour: profile.birthHour,
    birth_minute: profile.birthMinute,
    birth_location_code: profile.birthLocationCode,
    birth_location_label: profile.birthLocationLabel || null,
    birth_latitude: profile.birthLatitude,
    birth_longitude: profile.birthLongitude,
    solar_time_mode: profile.solarTimeMode,
    gender: profile.gender,
    note: profile.note || null,
    updated_at: new Date().toISOString(),
  };

  const response = await writeProfilePayloadWithFallback(profile, payload, (nextPayload) =>
    service
      .from('family_profiles')
      .insert(nextPayload)
      .select('id')
      .single()
  );

  if (response.error || !response.data) {
    if (isMissingFamilyProfilesTableError(response.error)) {
      throw new Error('운영 DB에 가족 프로필 테이블이 아직 적용되지 않았습니다. 003_profiles.sql 마이그레이션이 필요합니다.');
    }
    throw new Error(response.error ? getErrorMessage(response.error) : '가족 프로필을 저장하지 못했습니다.');
  }

  return response.data.id as string;
}

export async function updateFamilyProfile(
  userId: string,
  familyProfileId: string,
  profile: FamilyProfileInput
) {
  const service = await createServiceClient();

  const payload = {
    label: profile.label,
    relationship: profile.relationship,
    birth_calendar_type: profile.calendarType,
    birth_time_rule: profile.timeRule,
    birth_year: profile.birthYear,
    birth_month: profile.birthMonth,
    birth_day: profile.birthDay,
    birth_hour: profile.birthHour,
    birth_minute: profile.birthMinute,
    birth_location_code: profile.birthLocationCode,
    birth_location_label: profile.birthLocationLabel || null,
    birth_latitude: profile.birthLatitude,
    birth_longitude: profile.birthLongitude,
    solar_time_mode: profile.solarTimeMode,
    gender: profile.gender,
    note: profile.note || null,
    updated_at: new Date().toISOString(),
  };

  const response = await writeProfilePayloadWithFallback(profile, payload, (nextPayload) =>
    service
      .from('family_profiles')
      .update(nextPayload)
      .eq('id', familyProfileId)
      .eq('user_id', userId)
  );

  if (response.error) {
    if (isMissingFamilyProfilesTableError(response.error)) {
      throw new Error('운영 DB에 가족 프로필 테이블이 아직 적용되지 않았습니다. 003_profiles.sql 마이그레이션이 필요합니다.');
    }
    throw new Error(getErrorMessage(response.error));
  }
}

export async function deleteFamilyProfile(userId: string, familyProfileId: string) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('family_profiles')
    .delete()
    .eq('id', familyProfileId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    if (isMissingFamilyProfilesTableError(error)) {
      throw new Error('운영 DB에 가족 프로필 테이블이 아직 적용되지 않았습니다. 003_profiles.sql 마이그레이션이 필요합니다.');
    }
    throw new Error(error.message);
  }

  return Boolean(data);
}
