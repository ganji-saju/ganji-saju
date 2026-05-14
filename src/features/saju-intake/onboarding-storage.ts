'use client';

import { ONBOARDING_CONSENTS } from '@/content/moonlight';

export type OnboardingSpeechTone = 'friendly' | 'polite' | 'standard';
export type OnboardingProfileSource = 'manual' | 'self' | 'family';
export type OnboardingFocusTopic = 'today' | 'love' | 'wealth' | 'career' | 'relationship';

// 2026-05-15 PR 1: 사주아이 벤치마크 reference. 사주 시작 흐름에서 사용자 현재 상황 수집.
// types 자체는 lib/saju/types.ts 의 UserSituation 과 1:1 매핑.
export type OnboardingRelationshipStatus = '' | 'single' | 'dating' | 'married' | 'separated';
export type OnboardingOccupation =
  | ''
  | 'employee'
  | 'self-employed'
  | 'student'
  | 'homemaker'
  | 'job-seeking'
  | 'other';
export type OnboardingConcern =
  | ''
  | 'business'
  | 'romance'
  | 'family'
  | 'health'
  | 'wealth'
  | 'other';

export interface SajuOnboardingDraft {
  calendarType: 'solar' | 'lunar';
  timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  jasiMethod: 'split' | 'unified';
  birthLocationCode: string;
  birthLocationLabel: string;
  birthLatitude: string;
  birthLongitude: string;
  solarTimeMode: 'standard' | 'longitude';
  gender: string;
  nickname: string;
  loadedProfileSource: OnboardingProfileSource;
  focusTopic: OnboardingFocusTopic;
  tone: OnboardingSpeechTone;
  consents: Record<string, boolean>;
  // 2026-05-15 PR 1: 사용자 현재 상황 — 3 항목 (연애/직업/고민) + 자유 입력.
  relationshipStatus: OnboardingRelationshipStatus;
  occupation: OnboardingOccupation;
  currentConcern: OnboardingConcern;
  concernNote: string;
}

export const ONBOARDING_STORAGE_KEY = 'moonlight:saju-onboarding-draft';
export const ONBOARDING_CONSENT_STORAGE_KEY = 'moonlight:saju-onboarding-consent-v1';
export const RECENT_GUEST_INPUT_STORAGE_KEY = 'moonlight:saju-recent-guest-input-v1';

function getRequiredConsentSignature() {
  return ONBOARDING_CONSENTS.filter((item) => item.required)
    .map((item) => item.title)
    .join('|');
}

function createConsentState() {
  return Object.fromEntries(
    ONBOARDING_CONSENTS.map((item) => [item.title, false])
  ) as Record<string, boolean>;
}

export function createInitialOnboardingDraft(): SajuOnboardingDraft {
  return {
    calendarType: 'solar',
    timeRule: 'standard',
    year: '',
    month: '',
    day: '',
    hour: '',
    minute: '',
    jasiMethod: 'unified',
    birthLocationCode: '',
    birthLocationLabel: '',
    birthLatitude: '',
    birthLongitude: '',
    solarTimeMode: 'standard',
    gender: '',
    nickname: '',
    loadedProfileSource: 'manual',
    focusTopic: 'today',
    tone: 'polite',
    consents: createConsentState(),
    // 2026-05-15 PR 1: 사용자 현재 상황 초기값 (모두 미선택).
    relationshipStatus: '',
    occupation: '',
    currentConcern: '',
    concernNote: '',
  };
}

function normalizeFocusTopic(value: unknown): OnboardingFocusTopic {
  return value === 'love' ||
    value === 'wealth' ||
    value === 'career' ||
    value === 'relationship'
    ? value
    : 'today';
}

function mergeConsentState(value: unknown) {
  const fallback = createConsentState();
  if (!value || typeof value !== 'object') return fallback;

  const incoming = value as Record<string, unknown>;
  return Object.fromEntries(
    ONBOARDING_CONSENTS.map((item) => [item.title, typeof incoming[item.title] === 'boolean' ? incoming[item.title] : false])
  ) as Record<string, boolean>;
}

function normalizeOnboardingDraft(parsed: Partial<SajuOnboardingDraft>): SajuOnboardingDraft {
  return {
    calendarType: parsed.calendarType === 'lunar' ? 'lunar' : 'solar',
    timeRule:
      parsed.timeRule === 'trueSolarTime' ||
      parsed.timeRule === 'nightZi' ||
      parsed.timeRule === 'earlyZi'
        ? parsed.timeRule
        : 'standard',
    year: typeof parsed.year === 'string' ? parsed.year : '',
    month: typeof parsed.month === 'string' ? parsed.month : '',
    day: typeof parsed.day === 'string' ? parsed.day : '',
    hour: typeof parsed.hour === 'string' ? parsed.hour : '',
    minute: typeof parsed.minute === 'string' ? parsed.minute : '',
    jasiMethod: parsed.jasiMethod === 'split' ? 'split' : 'unified',
    birthLocationCode: typeof parsed.birthLocationCode === 'string' ? parsed.birthLocationCode : '',
    birthLocationLabel: typeof parsed.birthLocationLabel === 'string' ? parsed.birthLocationLabel : '',
    birthLatitude: typeof parsed.birthLatitude === 'string' ? parsed.birthLatitude : '',
    birthLongitude: typeof parsed.birthLongitude === 'string' ? parsed.birthLongitude : '',
    solarTimeMode: parsed.solarTimeMode === 'longitude' ? 'longitude' : 'standard',
    gender: typeof parsed.gender === 'string' ? parsed.gender : '',
    nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
    loadedProfileSource:
      parsed.loadedProfileSource === 'self' || parsed.loadedProfileSource === 'family'
        ? parsed.loadedProfileSource
        : 'manual',
    focusTopic: normalizeFocusTopic(parsed.focusTopic),
    tone:
      parsed.tone === 'friendly' || parsed.tone === 'polite' || parsed.tone === 'standard'
        ? parsed.tone
        : 'polite',
    consents: mergeConsentState(parsed.consents),
    // 2026-05-15 PR 1: 사용자 현재 상황 normalize.
    relationshipStatus: normalizeRelationship(parsed.relationshipStatus),
    occupation: normalizeOccupation(parsed.occupation),
    currentConcern: normalizeConcern(parsed.currentConcern),
    concernNote: typeof parsed.concernNote === 'string' ? parsed.concernNote.slice(0, 80) : '',
  };
}

function normalizeRelationship(value: unknown): OnboardingRelationshipStatus {
  return value === 'single' || value === 'dating' || value === 'married' || value === 'separated' ? value : '';
}
function normalizeOccupation(value: unknown): OnboardingOccupation {
  return value === 'employee' ||
    value === 'self-employed' ||
    value === 'student' ||
    value === 'homemaker' ||
    value === 'job-seeking' ||
    value === 'other'
    ? value
    : '';
}
function normalizeConcern(value: unknown): OnboardingConcern {
  return value === 'business' ||
    value === 'romance' ||
    value === 'family' ||
    value === 'health' ||
    value === 'wealth' ||
    value === 'other'
    ? value
    : '';
}

// 2026-05-15 PR 1: SajuOnboardingDraft 의 현재 상황 3항목을 API payload 형태 UserSituation 으로 변환.
import type { UserSituation } from '@/lib/saju/types';
export function toUserSituation(draft: SajuOnboardingDraft): UserSituation | null {
  const situation: UserSituation = {};
  if (draft.relationshipStatus) situation.relationshipStatus = draft.relationshipStatus;
  if (draft.occupation) situation.occupation = draft.occupation;
  if (draft.currentConcern) situation.currentConcern = draft.currentConcern;
  const note = draft.concernNote.trim().slice(0, 80);
  if (note) situation.concernNote = note;
  return Object.keys(situation).length > 0 ? situation : null;
}

export function loadOnboardingDraft(): SajuOnboardingDraft {
  if (typeof window === 'undefined') {
    return createInitialOnboardingDraft();
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return createInitialOnboardingDraft();

    const parsed = JSON.parse(raw) as Partial<SajuOnboardingDraft>;
    return normalizeOnboardingDraft(parsed);
  } catch {
    return createInitialOnboardingDraft();
  }
}

export function saveOnboardingDraft(draft: SajuOnboardingDraft) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(draft));
}

export function clearOnboardingDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export function hasCompleteRecentGuestInput(draft: SajuOnboardingDraft) {
  return Boolean(
    draft.year.trim() &&
      draft.month.trim() &&
      draft.day.trim() &&
      (draft.gender === 'male' || draft.gender === 'female') &&
      draft.birthLocationCode.trim()
  );
}

export function loadRecentGuestInput(): SajuOnboardingDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(RECENT_GUEST_INPUT_STORAGE_KEY);
    if (!raw) return null;

    const draft = normalizeOnboardingDraft(JSON.parse(raw) as Partial<SajuOnboardingDraft>);
    return hasCompleteRecentGuestInput(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function saveRecentGuestInput(draft: SajuOnboardingDraft) {
  if (typeof window === 'undefined') return;
  if (!hasCompleteRecentGuestInput(draft)) return;

  const snapshot: SajuOnboardingDraft = {
    ...draft,
    loadedProfileSource: 'manual',
    consents: createConsentState(),
  };

  window.localStorage.setItem(RECENT_GUEST_INPUT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearRecentGuestInput() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(RECENT_GUEST_INPUT_STORAGE_KEY);
}

export function hasAcceptedRequiredConsents() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(ONBOARDING_CONSENT_STORAGE_KEY) === getRequiredConsentSignature();
  } catch {
    return false;
  }
}

export function saveAcceptedRequiredConsents() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ONBOARDING_CONSENT_STORAGE_KEY, getRequiredConsentSignature());
  } catch {}
}

export function getHonorificLabel(nickname: string) {
  const trimmed = nickname.trim();
  if (!trimmed) return '선생님';
  if (trimmed.endsWith('님') || trimmed.endsWith('선생님')) return trimmed;
  return `${trimmed} 선생님`;
}

export function shouldAutoSavePersonalProfile(source: OnboardingProfileSource) {
  return source !== 'family';
}

export function buildTonePreview(tone: OnboardingSpeechTone, nickname: string) {
  const honorific = getHonorificLabel(nickname);

  switch (tone) {
    case 'friendly':
      return `${honorific}, 오늘은 마음을 가볍게 놓으셔도 괜찮습니다.`;
    case 'standard':
      return `${honorific}, 오늘의 흐름을 차분히 정리해 드리겠습니다.`;
    case 'polite':
    default:
      return `${honorific}, 오늘의 흐름을 정중히 살펴드리겠습니다.`;
  }
}
