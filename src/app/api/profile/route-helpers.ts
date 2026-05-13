import { normalizeMoonlightCounselor } from '@/lib/counselors';
import type { UserProfile } from '@/lib/profile';
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

export function parseProfile(payload: unknown): UserProfile | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
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
    displayName,
    calendarType,
    timeRule,
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
    preferredCounselor: normalizeMoonlightCounselor(data.preferredCounselor),
  };
}
