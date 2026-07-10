'use client';

import {
  createInitialOnboardingDraft,
  loadRecentGuestInput,
  type SajuOnboardingDraft,
  type OnboardingFocusTopic,
  type OnboardingRelationshipStatus,
  type OnboardingOccupation,
  type OnboardingConcern,
} from '@/features/saju-intake/onboarding-storage';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';

export const BIRTH_PROFILE_STORAGE_KEY = 'moonlight:birth-profile:last';

export interface UnifiedBirthProfile {
  name: string;
  calendarType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  hour: string;
  unknownBirthTime: boolean;
  gender: string;
  birthLocationCode: string;
  birthLocationLabel: string;
  birthLatitude: string;
  birthLongitude: string;
  timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
  solarTimeMode: 'standard' | 'longitude';
  focusTopic: OnboardingFocusTopic;
  relationshipStatus: OnboardingRelationshipStatus;
  occupation: OnboardingOccupation;
  currentConcern: OnboardingConcern;
  concernNote: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function createEmptyBirthProfile(): UnifiedBirthProfile {
  return {
    name: '', calendarType: 'solar', year: '', month: '', day: '', hour: '',
    unknownBirthTime: false, gender: '', birthLocationCode: '', birthLocationLabel: '',
    birthLatitude: '', birthLongitude: '', timeRule: 'standard', solarTimeMode: 'standard',
    focusTopic: 'today', relationshipStatus: '', occupation: '', currentConcern: '', concernNote: '',
  };
}

function normFocus(v: unknown): OnboardingFocusTopic {
  return v === 'love' || v === 'wealth' || v === 'career' || v === 'relationship' ? v : 'today';
}
function normRel(v: unknown): OnboardingRelationshipStatus {
  return v === 'single' || v === 'dating' || v === 'married' || v === 'separated' ? v : '';
}
function normOcc(v: unknown): OnboardingOccupation {
  return v === 'employee' || v === 'self-employed' || v === 'student' || v === 'homemaker' || v === 'job-seeking' || v === 'other' ? v : '';
}
function normConcern(v: unknown): OnboardingConcern {
  return v === 'business' || v === 'romance' || v === 'family' || v === 'health' || v === 'wealth' || v === 'other' ? v : '';
}

export function normalizeBirthProfile(parsed: Partial<UnifiedBirthProfile>): UnifiedBirthProfile {
  return {
    name: str(parsed.name).slice(0, 20),
    calendarType: parsed.calendarType === 'lunar' ? 'lunar' : 'solar',
    year: str(parsed.year), month: str(parsed.month), day: str(parsed.day),
    hour: str(parsed.hour),
    unknownBirthTime: parsed.unknownBirthTime === true || str(parsed.hour) === '',
    gender: parsed.gender === 'male' || parsed.gender === 'female' ? parsed.gender : '',
    birthLocationCode: str(parsed.birthLocationCode),
    birthLocationLabel: str(parsed.birthLocationLabel),
    birthLatitude: str(parsed.birthLatitude), birthLongitude: str(parsed.birthLongitude),
    timeRule:
      parsed.timeRule === 'trueSolarTime' || parsed.timeRule === 'nightZi' || parsed.timeRule === 'earlyZi'
        ? parsed.timeRule : 'standard',
    solarTimeMode: parsed.solarTimeMode === 'longitude' ? 'longitude' : 'standard',
    focusTopic: normFocus(parsed.focusTopic),
    relationshipStatus: normRel(parsed.relationshipStatus),
    occupation: normOcc(parsed.occupation),
    currentConcern: normConcern(parsed.currentConcern),
    concernNote: str(parsed.concernNote).slice(0, 80),
  };
}

export function hasCompleteBirthProfile(p: UnifiedBirthProfile): boolean {
  return Boolean(
    p.year.trim() && p.month.trim() && p.day.trim() &&
    (p.gender === 'male' || p.gender === 'female') &&
    p.birthLocationCode.trim()
  );
}

export function profileFromSajuDraft(d: SajuOnboardingDraft): UnifiedBirthProfile {
  return normalizeBirthProfile({
    name: d.nickname,
    calendarType: d.calendarType, year: d.year, month: d.month, day: d.day, hour: d.hour,
    unknownBirthTime: d.hour === '',
    gender: d.gender, birthLocationCode: d.birthLocationCode, birthLocationLabel: d.birthLocationLabel,
    birthLatitude: d.birthLatitude, birthLongitude: d.birthLongitude,
    timeRule: d.timeRule, solarTimeMode: d.solarTimeMode,
    focusTopic: d.focusTopic, relationshipStatus: d.relationshipStatus,
    occupation: d.occupation, currentConcern: d.currentConcern, concernNote: d.concernNote,
  });
}

export function loadBirthProfile(): UnifiedBirthProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BIRTH_PROFILE_STORAGE_KEY);
    if (raw) {
      const p = normalizeBirthProfile(JSON.parse(raw) as Partial<UnifiedBirthProfile>);
      if (hasCompleteBirthProfile(p)) return p;
    }
  } catch {
    /* fall through to legacy */
  }
  // 레거시 흡수: 사주 recent-guest-input → 신규 키로 1회 이관.
  const legacy = loadRecentGuestInput();
  if (legacy) {
    const p = profileFromSajuDraft(legacy);
    if (hasCompleteBirthProfile(p)) {
      saveBirthProfile(p);
      return p;
    }
  }
  return null;
}

export function saveBirthProfile(p: UnifiedBirthProfile): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BIRTH_PROFILE_STORAGE_KEY, JSON.stringify(normalizeBirthProfile(p)));
}

export function clearBirthProfile(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BIRTH_PROFILE_STORAGE_KEY);
}

export function applyProfileToSajuDraft(base: SajuOnboardingDraft, p: UnifiedBirthProfile): SajuOnboardingDraft {
  return {
    ...base,
    nickname: p.name || base.nickname,
    calendarType: p.calendarType, year: p.year, month: p.month, day: p.day,
    hour: p.unknownBirthTime ? '' : p.hour,
    minute: p.unknownBirthTime ? '' : base.minute,
    gender: p.gender, birthLocationCode: p.birthLocationCode, birthLocationLabel: p.birthLocationLabel,
    birthLatitude: p.birthLatitude, birthLongitude: p.birthLongitude,
    timeRule: p.timeRule, solarTimeMode: p.solarTimeMode,
    focusTopic: p.focusTopic, relationshipStatus: p.relationshipStatus,
    occupation: p.occupation, currentConcern: p.currentConcern, concernNote: p.concernNote,
  };
}

export function applyProfileToTodayPayload(base: TodayFortuneBirthPayload, p: UnifiedBirthProfile): TodayFortuneBirthPayload {
  return {
    ...base,
    calendarType: p.calendarType, year: p.year, month: p.month, day: p.day,
    hour: p.unknownBirthTime ? '' : p.hour,
    minute: p.unknownBirthTime ? '' : base.minute,
    unknownBirthTime: p.unknownBirthTime,
    gender: p.gender, birthLocationCode: p.birthLocationCode, birthLocationLabel: p.birthLocationLabel,
    birthLatitude: p.birthLatitude, birthLongitude: p.birthLongitude,
    timeRule: p.timeRule,
  };
}
