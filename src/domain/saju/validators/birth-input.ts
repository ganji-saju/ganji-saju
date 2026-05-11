import type { BirthInput } from '@/lib/saju/types';
import { readStringValue as readString } from '@/lib/api-utils';
import { DEFAULT_BIRTH_TIMEZONE, getBirthLocationPreset } from '@/lib/saju/birth-location';

export interface BirthInputDraft {
  name?: unknown;
  year?: unknown;
  month?: unknown;
  day?: unknown;
  hour?: unknown;
  minute?: unknown;
  unknownTime?: unknown;
  jasiMethod?: unknown;
  gender?: unknown;
  birthLocationCode?: unknown;
  birthLocationLabel?: unknown;
  birthLatitude?: unknown;
  birthLongitude?: unknown;
  birthLocation?: unknown;
  solarTimeMode?: unknown;
}

interface ParseBirthInputOptions {
  requireGender?: boolean;
}

export type ParsedBirthInput =
  | { ok: true; input: BirthInput }
  | { ok: false; error: string };

function toInt(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function toNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBirthLocationObject(value: unknown): BirthInput['birthLocation'] | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const label = readString(record.label);
  const latitude = toNumber(record.latitude);
  const longitude = toNumber(record.longitude);

  if (!label || latitude === null || longitude === null) return null;

  return {
    code: readString(record.code) || undefined,
    label,
    latitude,
    longitude,
    timezone: readString(record.timezone) || DEFAULT_BIRTH_TIMEZONE,
  };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidBirthInput(input: BirthInput): boolean {
  const { year, month, day, hour, minute, jasiMethod, unknownTime, birthLocation, solarTimeMode } = input;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > getDaysInMonth(year, month)
  ) {
    return false;
  }

  if (hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23)) {
    return false;
  }

  if (
    !unknownTime &&
    minute !== undefined &&
    (!Number.isInteger(minute) || minute < 0 || minute > 59)
  ) {
    return false;
  }

  if (
    jasiMethod !== undefined &&
    jasiMethod !== 'split' &&
    jasiMethod !== 'unified'
  ) {
    return false;
  }

  if (solarTimeMode !== undefined && solarTimeMode !== 'standard' && solarTimeMode !== 'longitude') {
    return false;
  }

  if (birthLocation) {
    if (
      !birthLocation.label.trim() ||
      !Number.isFinite(birthLocation.latitude) ||
      !Number.isFinite(birthLocation.longitude) ||
      birthLocation.latitude < -90 ||
      birthLocation.latitude > 90 ||
      birthLocation.longitude < -180 ||
      birthLocation.longitude > 180
    ) {
      return false;
    }
  }

  return true;
}

function parseBirthLocation(draft: BirthInputDraft): BirthInput['birthLocation'] | 'invalid' {
  const directLocation = readBirthLocationObject(draft.birthLocation);
  if (directLocation) return directLocation;

  const code = readString(draft.birthLocationCode);
  if (!code) return null;

  if (code !== 'custom') {
    return getBirthLocationPreset(code) ?? 'invalid';
  }

  const label = readString(draft.birthLocationLabel) || '직접 입력 지역';
  const latitude = toNumber(draft.birthLatitude);
  const longitude = toNumber(draft.birthLongitude);

  if (latitude === null || longitude === null) return 'invalid';
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return 'invalid';

  return {
    code: 'custom',
    label,
    latitude,
    longitude,
    timezone: DEFAULT_BIRTH_TIMEZONE,
  };
}

export function parseBirthInputDraft(
  draft: BirthInputDraft | null | undefined,
  options: ParseBirthInputOptions = {}
): ParsedBirthInput {
  if (!draft) {
    return { ok: false, error: '입력 정보가 비어 있습니다.' };
  }

  const year = toInt(draft.year);
  const month = toInt(draft.month);
  const day = toInt(draft.day);

  if (year === null || month === null || day === null) {
    return { ok: false, error: '생년월일을 모두 입력해 주세요.' };
  }

  let hour: number | undefined;
  let minute: number | undefined;
  const unknownTime = draft.unknownTime === true;

  if (draft.hour !== undefined && draft.hour !== null && draft.hour !== '') {
    const parsedHour = toInt(draft.hour);
    if (parsedHour === null) {
      return { ok: false, error: '태어난 시간은 0시부터 23시 사이로 입력해 주세요.' };
    }
    hour = parsedHour;
  }

  if (!unknownTime && draft.minute !== undefined && draft.minute !== null && draft.minute !== '') {
    if (hour === undefined) {
      return { ok: false, error: '분을 입력하시려면 태어난 시간도 함께 선택해 주세요.' };
    }

    const parsedMinute = toInt(draft.minute);
    if (parsedMinute === null) {
      return { ok: false, error: '태어난 분은 0분부터 59분 사이로 입력해 주세요.' };
    }

    minute = parsedMinute;
  }

  let jasiMethod: BirthInput['jasiMethod'];
  if (draft.jasiMethod === 'split' || draft.jasiMethod === 'unified') {
    jasiMethod = draft.jasiMethod;
  }

  let gender: BirthInput['gender'];
  if (draft.gender === 'male' || draft.gender === 'female') {
    gender = draft.gender;
  } else if (options.requireGender) {
    return { ok: false, error: '정밀 입력에서는 성별 선택이 필요합니다.' };
  }

  const birthLocation = parseBirthLocation(draft);
  if (birthLocation === 'invalid') {
    return { ok: false, error: '출생 지역의 위도와 경도를 다시 확인해 주세요.' };
  }

  const solarTimeMode: BirthInput['solarTimeMode'] =
    draft.solarTimeMode === 'longitude' && birthLocation ? 'longitude' : 'standard';
  const name = readString(draft.name);

  const input: BirthInput = {
    name: name || undefined,
    year,
    month,
    day,
    hour: unknownTime ? undefined : hour,
    minute: unknownTime ? undefined : minute,
    unknownTime,
    jasiMethod,
    gender,
    birthLocation,
    solarTimeMode,
  };

  if (!isValidBirthInput(input)) {
    return { ok: false, error: '생년월일을 다시 확인해 주세요.' };
  }

  return { ok: true, input };
}
