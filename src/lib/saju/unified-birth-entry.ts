import { Lunar } from 'lunar-typescript';
import type { BirthInput } from '@/lib/saju/types';
import {
  parseBirthInputDraft,
  type BirthInputDraft,
} from '@/domain/saju/validators/birth-input';

export type UnifiedCalendarType = 'solar' | 'lunar';
export type UnifiedTimeRule = 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';

export interface UnifiedBirthEntryDraft {
  calendarType: UnifiedCalendarType;
  timeRule: UnifiedTimeRule;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  unknownBirthTime: boolean;
  gender: string;
  birthLocationCode: string;
  birthLocationLabel: string;
  birthLatitude: string;
  birthLongitude: string;
}

export type ResolvedUnifiedBirthInput =
  | {
      ok: true;
      input: BirthInput;
      calendarType: UnifiedCalendarType;
      timeRule: UnifiedTimeRule;
      normalizedBirthDraft: BirthInputDraft;
    }
  | {
      ok: false;
      error: string;
      calendarType: UnifiedCalendarType;
      timeRule: UnifiedTimeRule;
      normalizedBirthDraft: BirthInputDraft;
    };

function toInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeCalendarDate(
  draft: UnifiedBirthEntryDraft
): Pick<UnifiedBirthEntryDraft, 'year' | 'month' | 'day'> {
  if (draft.calendarType !== 'lunar') {
    return {
      year: draft.year,
      month: draft.month,
      day: draft.day,
    };
  }

  const year = toInt(draft.year);
  const month = toInt(draft.month);
  const day = toInt(draft.day);

  if (year === null || month === null || day === null) {
    return {
      year: draft.year,
      month: draft.month,
      day: draft.day,
    };
  }

  const solar = Lunar.fromYmd(year, month, day).getSolar();

  return {
    year: String(solar.getYear()),
    month: String(solar.getMonth()),
    day: String(solar.getDay()),
  };
}

export function toBirthInputDraftFromUnifiedEntry(
  draft: UnifiedBirthEntryDraft
): BirthInputDraft {
  const normalizedDate = normalizeCalendarDate(draft);
  const hasLocation = draft.birthLocationCode.trim().length > 0;
  const useLongitude = draft.timeRule === 'trueSolarTime' && hasLocation;
  const usesSplit = draft.timeRule === 'earlyZi';

  return {
    year: normalizedDate.year,
    month: normalizedDate.month,
    day: normalizedDate.day,
    hour: draft.hour,
    minute: draft.minute,
    unknownTime: draft.unknownBirthTime,
    jasiMethod: usesSplit ? 'split' : 'unified',
    gender: draft.gender,
    birthLocationCode: draft.birthLocationCode,
    birthLocationLabel: draft.birthLocationLabel,
    birthLatitude: draft.birthLatitude,
    birthLongitude: draft.birthLongitude,
    solarTimeMode: useLongitude ? 'longitude' : 'standard',
  };
}

export function resolveUnifiedBirthInput(
  draft: UnifiedBirthEntryDraft,
  options: Parameters<typeof parseBirthInputDraft>[1] = {}
): ResolvedUnifiedBirthInput {
  let normalizedBirthDraft: BirthInputDraft;
  try {
    normalizedBirthDraft = toBirthInputDraftFromUnifiedEntry(draft);
  } catch {
    // 음력에 없는 날짜(예: 1990-4-30)는 Lunar.fromYmd 가 던진다 — 변환 못 한 입력 그대로의 초안으로 실패를 돌려준다.
    return {
      ok: false,
      error: '생년월일을 다시 확인해 주세요.',
      calendarType: draft.calendarType,
      timeRule: draft.timeRule,
      normalizedBirthDraft: toBirthInputDraftFromUnifiedEntry({ ...draft, calendarType: 'solar' }),
    };
  }
  const parsed = parseBirthInputDraft(normalizedBirthDraft, options);

  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      calendarType: draft.calendarType,
      timeRule: draft.timeRule,
      normalizedBirthDraft,
    };
  }

  return {
    ok: true,
    input: parsed.input,
    calendarType: draft.calendarType,
    timeRule: draft.timeRule,
    normalizedBirthDraft,
  };
}

export function isUnifiedBirthEntryDraft(value: unknown): value is UnifiedBirthEntryDraft {
  if (!value || typeof value !== 'object') return false;

  const data = value as Record<string, unknown>;
  return (
    typeof data.year === 'string' &&
    typeof data.month === 'string' &&
    typeof data.day === 'string' &&
    typeof data.hour === 'string' &&
    typeof data.minute === 'string' &&
    typeof data.gender === 'string' &&
    typeof data.birthLocationCode === 'string' &&
    typeof data.birthLocationLabel === 'string' &&
    typeof data.birthLatitude === 'string' &&
    typeof data.birthLongitude === 'string' &&
    typeof data.unknownBirthTime === 'boolean' &&
    (data.calendarType === 'solar' || data.calendarType === 'lunar') &&
    (data.timeRule === 'standard' ||
      data.timeRule === 'trueSolarTime' ||
      data.timeRule === 'nightZi' ||
      data.timeRule === 'earlyZi')
  );
}
