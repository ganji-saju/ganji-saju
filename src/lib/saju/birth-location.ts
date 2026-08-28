import type { BirthInput, BirthLocation, SolarTimeMode } from './types';

export const KST_STANDARD_MERIDIAN = 135;
export const DEFAULT_BIRTH_TIMEZONE = 'Asia/Seoul';

export const BIRTH_LOCATION_PRESETS = [
  { code: 'seoul', label: '서울', latitude: 37.5665, longitude: 126.9780 },
  { code: 'busan', label: '부산', latitude: 35.1796, longitude: 129.0756 },
  { code: 'daegu', label: '대구', latitude: 35.8714, longitude: 128.6014 },
  { code: 'incheon', label: '인천', latitude: 37.4563, longitude: 126.7052 },
  { code: 'gwangju', label: '광주', latitude: 35.1595, longitude: 126.8526 },
  { code: 'daejeon', label: '대전', latitude: 36.3504, longitude: 127.3845 },
  { code: 'ulsan', label: '울산', latitude: 35.5384, longitude: 129.3114 },
  { code: 'sejong', label: '세종', latitude: 36.4800, longitude: 127.2890 },
  { code: 'suwon', label: '수원', latitude: 37.2636, longitude: 127.0286 },
  { code: 'chuncheon', label: '춘천', latitude: 37.8813, longitude: 127.7298 },
  { code: 'cheongju', label: '청주', latitude: 36.6424, longitude: 127.4890 },
  { code: 'jeonju', label: '전주', latitude: 35.8242, longitude: 127.1480 },
  { code: 'changwon', label: '창원', latitude: 35.2279, longitude: 128.6811 },
  { code: 'jeju', label: '제주', latitude: 33.4996, longitude: 126.5312 },
] as const;

export type BirthLocationPresetCode = (typeof BIRTH_LOCATION_PRESETS)[number]['code'];

export interface BirthTimeCorrection {
  mode: SolarTimeMode;
  timezone: string;
  standardMeridian: number;
  longitude: number | null;
  latitude: number | null;
  offsetMinutes: number;
  originalBirth: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  adjustedBirth: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
}

/**
 * 🔴 2026-08-29 — 출생지는 **프리셋 표 밖에서도 온다.**
 *
 *   '좌표 찾기'(/api/geo/birth-location)로 고른 지역은 code 가 'custom' 이고 좌표만 있다.
 *   그런데 회원가입 API 는 `getBirthLocationPreset(code)` 하나로만 판정해서, 검색으로 고른
 *   사용자는 **"출생지를 선택해 주세요."** 를 맞았다(프리셋 14개 칩을 누르면 통과).
 *   검색 결과를 화면에 띄워놓고 그걸로는 가입이 안 되는 상태였다.
 *
 *   프리셋 우선, 없으면 label+좌표로 받는다. 좌표는 신뢰 경계라 범위까지 본다.
 */
export function resolveBirthLocationInput(input: {
  code?: string | null;
  label?: string | null;
  latitude?: unknown;
  longitude?: unknown;
}): BirthLocation | null {
  const preset = getBirthLocationPreset(input.code);
  if (preset) return preset;

  const label = String(input.label ?? '').trim();
  const latitude = toFiniteCoordinate(input.latitude);
  const longitude = toFiniteCoordinate(input.longitude);
  if (!label || latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  return {
    code: String(input.code ?? '').trim() || 'custom',
    label,
    latitude,
    longitude,
    timezone: DEFAULT_BIRTH_TIMEZONE,
  };
}

/** 숫자 또는 숫자 문자열만 받는다. '' · null · NaN · Infinity 는 전부 미입력으로 본다. */
function toFiniteCoordinate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getBirthLocationPreset(code: string | null | undefined): BirthLocation | null {
  const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
  if (!preset) return null;

  return {
    code: preset.code,
    label: preset.label,
    latitude: preset.latitude,
    longitude: preset.longitude,
    timezone: DEFAULT_BIRTH_TIMEZONE,
  };
}

export function getSolarTimeOffsetMinutes({
  longitude,
  standardMeridian = KST_STANDARD_MERIDIAN,
}: {
  longitude: number;
  standardMeridian?: number;
}) {
  return Math.round((longitude - standardMeridian) * 4);
}

function shiftLocalDateTime({
  year,
  month,
  day,
  hour,
  minute,
  offsetMinutes,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  offsetMinutes: number;
}) {
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute + offsetMinutes, 0));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function buildBirthTimeCorrection(
  input: Pick<
    BirthInput,
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'unknownTime' | 'birthLocation' | 'solarTimeMode'
  >
): BirthTimeCorrection | null {
  if (input.unknownTime || input.hour === undefined) return null;
  if (input.solarTimeMode !== 'longitude') return null;
  if (!input.birthLocation) return null;

  const minute = input.minute ?? 30;
  const timezone = input.birthLocation.timezone ?? DEFAULT_BIRTH_TIMEZONE;
  const offsetMinutes = getSolarTimeOffsetMinutes({
    longitude: input.birthLocation.longitude,
    standardMeridian: KST_STANDARD_MERIDIAN,
  });
  const adjustedBirth = shiftLocalDateTime({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute,
    offsetMinutes,
  });

  return {
    mode: 'longitude',
    timezone,
    standardMeridian: KST_STANDARD_MERIDIAN,
    longitude: input.birthLocation.longitude,
    latitude: input.birthLocation.latitude,
    offsetMinutes,
    originalBirth: {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute,
    },
    adjustedBirth,
  };
}

export function getBirthCalculationDateTime(
  input: Pick<
    BirthInput,
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'unknownTime' | 'birthLocation' | 'solarTimeMode'
  >
) {
  const correction = buildBirthTimeCorrection(input);
  if (correction) return correction.adjustedBirth;

  return {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.unknownTime || input.hour === undefined ? 12 : input.hour,
    minute: input.unknownTime || input.hour === undefined ? 0 : input.minute ?? 30,
  };
}
