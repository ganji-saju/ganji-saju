'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ProductGrid } from '@/components/layout/product-grid';
import LegalLinks from '@/components/legal-links';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Button } from '@/components/ui/button';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import {
  UnifiedBirthInfoFields,
  type BirthLocationSearchResultLike,
  type UnifiedBirthInfoSection,
} from '@/components/saju/shared/unified-birth-info-fields';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ONBOARDING_CONSENTS, QUESTION_ENTRY_POINTS } from '@/content/moonlight';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import { isTasteProductId, type TasteProductId } from '@/lib/payments/catalog';
import { toSlug } from '@/lib/saju/pillars';
import { cn } from '@/lib/utils';
import {
  clearOnboardingDraft,
  clearRecentGuestInput,
  createInitialOnboardingDraft,
  hasAcceptedRequiredConsents,
  hasCompleteRecentGuestInput,
  loadOnboardingDraft,
  loadRecentGuestInput,
  saveAcceptedRequiredConsents,
  saveOnboardingDraft,
  saveRecentGuestInput,
  shouldAutoSavePersonalProfile,
  toUserSituation,
  type OnboardingFocusTopic,
  type SajuOnboardingDraft,
} from './onboarding-storage';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { trackMoonlightEvent } from '@/lib/analytics';
import { GangiIntro, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacWheelLoading } from '@/components/saju/zodiac-wheel-loading';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export type OnboardingStep = 'empathy' | 'birth' | 'nickname' | 'consent';
type SwipeStepId = 'profile' | 'birth' | 'location' | 'consent';

// 2026-05-15 PR 1: 현재 상황 3개 chip group helper. selected chip 토글 가능 (재클릭 시 선택 해제).
function SituationChipGroup<T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon?: string;
  value: T | '';
  onChange: (next: T | '') => void;
  options: ReadonlyArray<{ value: T; label: string; emoji?: string }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--app-copy-muted)]">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(selected ? '' : option.value)}
              data-selected={selected}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all active:scale-95',
                selected
                  ? 'border-[var(--app-pink-strong)] bg-[var(--app-pink-strong)] text-white shadow-[0_4px_12px_rgba(236,72,153,0.25)]'
                  : 'border-[var(--app-line)] bg-white text-[var(--app-copy)] hover:border-[var(--app-pink)]/40 hover:bg-[var(--app-pink-soft)]'
              )}
            >
              {option.emoji ? (
                <span aria-hidden="true" className="mr-1">
                  {option.emoji}
                </span>
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// PR #147 — 사용자 입력값 → 사람이 읽는 라벨 매핑. preview chip 에서 사용.
const RELATIONSHIP_PREVIEW: Record<string, { label: string; emoji: string }> = {
  single: { label: '솔로', emoji: '💛' },
  dating: { label: '연애 중', emoji: '💑' },
  married: { label: '기혼', emoji: '💍' },
  separated: { label: '이별·정리 중', emoji: '🍂' },
};

const OCCUPATION_PREVIEW: Record<string, { label: string; emoji: string }> = {
  employee: { label: '직장인', emoji: '💼' },
  'self-employed': { label: '자영업·프리랜서', emoji: '🛠' },
  student: { label: '학생', emoji: '📚' },
  homemaker: { label: '주부', emoji: '🏠' },
  'job-seeking': { label: '구직 중', emoji: '🔎' },
  other: { label: '기타', emoji: '✨' },
};

const CONCERN_PREVIEW: Record<string, { label: string; emoji: string }> = {
  business: { label: '사업·이직', emoji: '🚀' },
  romance: { label: '결혼·연애', emoji: '💞' },
  family: { label: '자녀·가족', emoji: '👨‍👩‍👧' },
  health: { label: '건강·멘탈', emoji: '🩺' },
  wealth: { label: '재물·투자', emoji: '💰' },
  other: { label: '직접 입력', emoji: '✍️' },
};
type ProfileLoadStatus = 'idle' | 'loading' | 'ready' | 'anonymous' | 'empty' | 'error';
type LocationSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface ProfileApiBirthFields {
  calendarType: 'solar' | 'lunar';
  timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthHour: number | null;
  birthMinute: number | null;
  birthLocationCode: string | null;
  birthLocationLabel: string;
  birthLatitude: number | null;
  birthLongitude: number | null;
  solarTimeMode: 'standard' | 'longitude';
  gender: 'male' | 'female' | null;
}

interface ProfileApiResponse {
  authenticated: boolean;
  profile: (ProfileApiBirthFields & {
    displayName: string;
    note: string;
  }) | null;
  familyProfiles: Array<
    ProfileApiBirthFields & {
      id: string;
      label: string;
      relationship: string;
      note: string;
      createdAt: string;
    }
  >;
  error?: string;
}

interface SavedBirthProfile {
  id: string;
  source: 'self' | 'family';
  label: string;
  nickname: string;
  detail: string;
  calendarType: 'solar' | 'lunar';
  timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number | null;
  birthMinute: number | null;
  birthLocationCode: string;
  birthLocationLabel: string;
  birthLatitude: number | null;
  birthLongitude: number | null;
  solarTimeMode: 'standard' | 'longitude';
  gender: 'male' | 'female' | null;
}

type BirthLocationSearchResult = BirthLocationSearchResultLike & {
  source: string;
  sourceRef: string;
  license: string;
};

interface BirthLocationSearchResponse {
  ok: boolean;
  error?: string;
  provider?: string;
  attribution?: string;
  items?: BirthLocationSearchResult[];
}

const PROFILE_STEP = {
  id: 'profile' as const,
  eyebrow: '궁금한 문제',
  title: '무엇이 궁금하세요?',
  description: '연애, 돈, 일, 가족, 올해 흐름 중 하나를 먼저 고릅니다.',
};

const BASE_STEPS: Array<{
  id: Exclude<SwipeStepId, 'profile' | 'consent'>;
  eyebrow: string;
  title: string;
  description: string;
  sections: readonly UnifiedBirthInfoSection[];
}> = [
  {
    id: 'birth',
    eyebrow: '기본 정보',
    title: '생년월일과 성별',
    description: '양력·음력, 연·월·일, 성별을 선택해 주세요.',
    sections: ['date', 'gender'],
  },
  {
    id: 'location',
    eyebrow: '출생지와 시간',
    title: '태어난 시간과 출생지',
    description: '시간을 모르면 시간 모름으로 진행해도 됩니다.',
    sections: ['location-time'],
  },
];

// Redesign 2026-05-13: 별도 동의 단계 제거 — 마지막 단계 CTA 하단 disclosure 로 implicit consent.
// CONSENT_STEP 정의 제거됨.

const ENTRY_FOCUS_TOPIC_BY_SLUG = {
  love: 'love',
  money: 'wealth',
  career: 'career',
  family: 'relationship',
  year: 'today',
  today: 'today',
} as const satisfies Record<(typeof QUESTION_ENTRY_POINTS)[number]['slug'], OnboardingFocusTopic>;

function normalizeEntryFocusParam(value: string | null): OnboardingFocusTopic | null {
  if (!value) return null;
  if (value === 'money') return 'wealth';
  if (value === 'family') return 'relationship';
  if (value === 'year') return 'today';
  if (value === 'today' || value === 'love' || value === 'wealth' || value === 'career' || value === 'relationship') {
    return value;
  }
  return null;
}

function getCurrentYearMonthScope() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildPostSubmitHref(
  id: string,
  focusTopic: OnboardingFocusTopic,
  product: TasteProductId | null,
  plan: 'lifetime' | null
) {
  if (plan === 'lifetime') {
    const params = new URLSearchParams({
      plan,
      slug: id,
      from: 'saju-new',
    });
    return `/membership/checkout?${params.toString()}`;
  }

  if (
    product === 'monthly-calendar' ||
    product === 'year-core' ||
    product === 'money-pattern' ||
    product === 'work-flow'
  ) {
    const params = new URLSearchParams({
      product,
      slug: id,
      from: 'saju-new',
    });
    if (product === 'monthly-calendar') params.set('scope', getCurrentYearMonthScope());
    if (product === 'year-core') params.set('scope', String(new Date().getFullYear()));
    return `/membership/checkout?${params.toString()}`;
  }

  return `/saju/${id}?from=saju-new&topic=${focusTopic}`;
}

function buildUnifiedBirthDraft(form: SajuOnboardingDraft): UnifiedBirthEntryDraft {
  return {
    calendarType: form.calendarType,
    timeRule: form.timeRule,
    year: form.year,
    month: form.month,
    day: form.day,
    hour: form.hour,
    minute: form.minute,
    unknownBirthTime: form.hour === '',
    gender: form.gender,
    birthLocationCode: form.birthLocationCode,
    birthLocationLabel: form.birthLocationLabel,
    birthLatitude: form.birthLatitude,
    birthLongitude: form.birthLongitude,
  };
}

// Redesign 2026-05-13: mockup screens-a.jsx 의 시간 ZodiacChip card 용 — hour → 12지(地支) 매핑.
const HOUR_BRANCHES: ReadonlyArray<{ zodiac: ZodiacKey; label: string; range: string; hours: readonly number[] }> = [
  { zodiac: 'rat',     label: '자시', range: '23:00 — 01:00', hours: [23, 0] },
  { zodiac: 'ox',      label: '축시', range: '01:00 — 03:00', hours: [1, 2] },
  { zodiac: 'tiger',   label: '인시', range: '03:00 — 05:00', hours: [3, 4] },
  { zodiac: 'rabbit',  label: '묘시', range: '05:00 — 07:00', hours: [5, 6] },
  { zodiac: 'dragon',  label: '진시', range: '07:00 — 09:00', hours: [7, 8] },
  { zodiac: 'snake',   label: '사시', range: '09:00 — 11:00', hours: [9, 10] },
  { zodiac: 'horse',   label: '오시', range: '11:00 — 13:00', hours: [11, 12] },
  { zodiac: 'sheep',   label: '미시', range: '13:00 — 15:00', hours: [13, 14] },
  { zodiac: 'monkey',  label: '신시', range: '15:00 — 17:00', hours: [15, 16] },
  { zodiac: 'rooster', label: '유시', range: '17:00 — 19:00', hours: [17, 18] },
  { zodiac: 'dog',     label: '술시', range: '19:00 — 21:00', hours: [19, 20] },
  { zodiac: 'pig',     label: '해시', range: '21:00 — 23:00', hours: [21, 22] },
] as const;

function getHourBranch(hourStr: string) {
  if (!hourStr) return null;
  const hour = Number.parseInt(hourStr, 10);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return HOUR_BRANCHES.find((b) => b.hours.includes(hour)) ?? null;
}

function applyUnifiedBirthPatch(
  current: SajuOnboardingDraft,
  patch: Partial<UnifiedBirthEntryDraft>
): SajuOnboardingDraft {
  const next: SajuOnboardingDraft = {
    ...current,
    calendarType: patch.calendarType ?? current.calendarType,
    timeRule: patch.timeRule ?? current.timeRule,
    year: patch.year ?? current.year,
    month: patch.month ?? current.month,
    day: patch.day ?? current.day,
    hour: patch.hour ?? current.hour,
    minute: patch.minute ?? current.minute,
    gender: patch.gender ?? current.gender,
    birthLocationCode: patch.birthLocationCode ?? current.birthLocationCode,
    birthLocationLabel: patch.birthLocationLabel ?? current.birthLocationLabel,
    birthLatitude: patch.birthLatitude ?? current.birthLatitude,
    birthLongitude: patch.birthLongitude ?? current.birthLongitude,
  };

  if (patch.unknownBirthTime === true || next.hour === '') {
    next.hour = '';
    next.minute = '';
  }

  next.jasiMethod = next.timeRule === 'earlyZi' ? 'split' : 'unified';
  next.solarTimeMode =
    next.timeRule === 'trueSolarTime' && next.birthLocationCode ? 'longitude' : 'standard';

  return next;
}

function hasReusableBirthDraft(draft: SajuOnboardingDraft) {
  return Boolean(
    draft.year.trim() &&
      draft.month.trim() &&
      draft.day.trim() &&
      (draft.gender === 'male' || draft.gender === 'female') &&
      draft.birthLocationCode.trim()
  );
}

function hasBirthFields<T extends ProfileApiBirthFields | null | undefined>(
  profile: T
): profile is NonNullable<T> & { birthYear: number; birthMonth: number; birthDay: number } {
  return Boolean(profile?.birthYear && profile.birthMonth && profile.birthDay);
}

function formatSavedProfileDetail(profile: ProfileApiBirthFields) {
  const calendarLabel = profile.calendarType === 'lunar' ? '음력' : '양력';
  const dateLabel = `${profile.birthYear}.${profile.birthMonth}.${profile.birthDay}`;
  const hourLabel =
    profile.birthHour === null
      ? '시간 미입력'
      : `${profile.birthHour}시${
          profile.birthMinute === null
            ? ''
            : ` ${String(profile.birthMinute).padStart(2, '0')}분`
        }`;
  const genderLabel =
    profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '성별 미선택';
  const locationLabel = profile.birthLocationLabel
    ? ` · ${profile.birthLocationLabel}${profile.solarTimeMode === 'longitude' ? ' 진태양시' : ''}`
    : '';
  return `${calendarLabel} ${dateLabel} · ${hourLabel} · ${genderLabel}${locationLabel}`;
}

function formatRecentGuestDetail(draft: SajuOnboardingDraft) {
  const calendarLabel = draft.calendarType === 'lunar' ? '음력' : '양력';
  const dateLabel = `${draft.year}.${draft.month}.${draft.day}`;
  const hourLabel = draft.hour
    ? `${draft.hour}시${draft.minute ? ` ${draft.minute.padStart(2, '0')}분` : ''}`
    : '시간 미입력';
  const genderLabel =
    draft.gender === 'male' ? '남성' : draft.gender === 'female' ? '여성' : '성별 미선택';
  const locationLabel = draft.birthLocationLabel
    ? ` · ${draft.birthLocationLabel}${draft.solarTimeMode === 'longitude' ? ' 진태양시' : ''}`
    : '';

  return `${calendarLabel} ${dateLabel} · ${hourLabel} · ${genderLabel}${locationLabel}`;
}

function buildSavedProfileOptions(data: ProfileApiResponse): SavedBirthProfile[] {
  const options: SavedBirthProfile[] = [];

  if (hasBirthFields(data.profile)) {
    options.push({
      id: 'self',
      source: 'self',
      label: data.profile.displayName ? `내 정보 · ${data.profile.displayName}` : '내 정보 불러오기',
      nickname: data.profile.displayName,
      detail: formatSavedProfileDetail(data.profile),
      calendarType: data.profile.calendarType ?? 'solar',
      timeRule: data.profile.timeRule ?? 'standard',
      birthYear: data.profile.birthYear,
      birthMonth: data.profile.birthMonth,
      birthDay: data.profile.birthDay,
      birthHour: data.profile.birthHour,
      birthMinute: data.profile.birthMinute,
      birthLocationCode: data.profile.birthLocationCode ?? '',
      birthLocationLabel: data.profile.birthLocationLabel ?? '',
      birthLatitude: data.profile.birthLatitude,
      birthLongitude: data.profile.birthLongitude,
      solarTimeMode: data.profile.solarTimeMode ?? 'standard',
      gender: data.profile.gender,
    });
  }

  data.familyProfiles.forEach((profile) => {
    if (!hasBirthFields(profile)) return;

    options.push({
      id: `family-${profile.id}`,
      source: 'family',
      label: `${profile.label} · ${profile.relationship}`,
      nickname: profile.label,
      detail: formatSavedProfileDetail(profile),
      calendarType: profile.calendarType ?? 'solar',
      timeRule: profile.timeRule ?? 'standard',
      birthYear: profile.birthYear,
      birthMonth: profile.birthMonth,
      birthDay: profile.birthDay,
      birthHour: profile.birthHour,
      birthMinute: profile.birthMinute,
      birthLocationCode: profile.birthLocationCode ?? '',
      birthLocationLabel: profile.birthLocationLabel ?? '',
      birthLatitude: profile.birthLatitude,
      birthLongitude: profile.birthLongitude,
      solarTimeMode: profile.solarTimeMode ?? 'standard',
      gender: profile.gender,
    });
  });

  return options;
}

export default function SajuIntakePage({ step: _step }: { step?: OnboardingStep }) {
  const router = useRouter();
  const [form, setForm] = useState<SajuOnboardingDraft>(createInitialOnboardingDraft());
  const [isHydrated, setIsHydrated] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [savedProfileOptions, setSavedProfileOptions] = useState<SavedBirthProfile[]>([]);
  const [recentGuestDraft, setRecentGuestDraft] = useState<SajuOnboardingDraft | null>(null);
  const [profileLoadStatus, setProfileLoadStatus] = useState<ProfileLoadStatus>('idle');
  const [profileLoadMessage, setProfileLoadMessage] = useState('');
  const [locationSearchStatus, setLocationSearchStatus] = useState<LocationSearchStatus>('idle');
  const [locationSearchMessage, setLocationSearchMessage] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<BirthLocationSearchResult[]>([]);
  const [selectedEntrySlug, setSelectedEntrySlug] =
    useState<(typeof QUESTION_ENTRY_POINTS)[number]['slug']>('today');
  const [pendingProduct, setPendingProduct] = useState<TasteProductId | null>(null);
  const [pendingPlan, setPendingPlan] = useState<'lifetime' | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const hasTrackedStartRef = useRef(false);
  const hasTrackedBirthStartRef = useRef(false);
  const hasAutoAppliedProfileRef = useRef(false);

  // Redesign 2026-05-13: mockup 은 별도 동의 단계 없이 단일 흐름. 필수 동의는 마지막 단계 제출 시
  // implicit 동의 + CTA 하단 disclosure text 로 처리. CONSENT_STEP 은 제거.
  // 2026-05-15 — 사용자 피드백: "step 1 이 정보 없이 간단해야 하는데 concern picker 가
  // 첫 화면에 나옴. 어떤 부분이 가장 궁금한지는 step 3 에서 선택하면 더 좋다."
  // → 순서 재배치: birth (step 1, 간단한 기본 정보) → location (step 2, 시간/지역) →
  //   profile (step 3, 무엇이 궁금한지 + 현재 상황). 제출은 마지막 단계 profile 에서.
  const steps = useMemo(
    () => [...BASE_STEPS, PROFILE_STEP],
    []
  );
  const activeStep = steps[activeIndex] ?? steps[0];
  const recentGuestDetail = recentGuestDraft ? formatRecentGuestDetail(recentGuestDraft) : '';
  const selectedEntryPoint =
    QUESTION_ENTRY_POINTS.find((entry) => entry.slug === selectedEntrySlug) ?? QUESTION_ENTRY_POINTS[0];
  const birthStepIndex = Math.max(0, steps.findIndex((item) => item.id === 'birth'));
  const locationStepIndex = Math.max(0, steps.findIndex((item) => item.id === 'location'));
  const profileStepIndex = Math.max(0, steps.findIndex((item) => item.id === 'profile'));
  // 2026-05-15 — 최종 제출 단계 = profile. (이전엔 location 이 마지막이었음.)
  const consentStepIndex = profileStepIndex;

  useEffect(() => {
    const draft = loadOnboardingDraft();
    const recent = loadRecentGuestInput();
    const focusParam =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('focus');
    const productParam =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('product');
    const planParam =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('plan');
    const initialFocusTopic = normalizeEntryFocusParam(focusParam);
    if (isTasteProductId(productParam)) {
      setPendingProduct(productParam);
      if (productParam === 'monthly-calendar' || productParam === 'year-core') {
        setSelectedEntrySlug('year');
      }
    }
    if (planParam === 'lifetime' || productParam === 'life-standard') {
      setPendingPlan('lifetime');
    }
    if (focusParam && focusParam in ENTRY_FOCUS_TOPIC_BY_SLUG) {
      setSelectedEntrySlug(focusParam as (typeof QUESTION_ENTRY_POINTS)[number]['slug']);
    } else if (initialFocusTopic === 'love') {
      setSelectedEntrySlug('love');
    } else if (initialFocusTopic === 'wealth') {
      setSelectedEntrySlug('money');
    } else if (initialFocusTopic === 'career') {
      setSelectedEntrySlug('career');
    } else if (initialFocusTopic === 'relationship') {
      setSelectedEntrySlug('family');
    }
    setForm(initialFocusTopic ? { ...draft, focusTopic: initialFocusTopic } : draft);
    setRecentGuestDraft(recent);
    setConsentAccepted(hasAcceptedRequiredConsents());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveOnboardingDraft(form);
  }, [form, isHydrated]);

  useEffect(() => {
    if (!isHydrated || hasTrackedStartRef.current) return;
    trackMoonlightEvent('saju_start_viewed', {
      from: 'saju-new',
      layout: 'swipe',
    });
    hasTrackedStartRef.current = true;
  }, [isHydrated]);

  useEffect(() => {
    if (activeIndex < steps.length) return;
    setActiveIndex(Math.max(0, steps.length - 1));
  }, [activeIndex, steps.length]);

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;

    async function loadSavedProfiles() {
      setProfileLoadStatus('loading');
      setProfileLoadMessage('');

      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        const data = (await response.json().catch(() => null)) as ProfileApiResponse | null;

        if (cancelled) return;

        if (!response.ok || !data) {
          setProfileLoadStatus('error');
          setProfileLoadMessage(data?.error ?? '저장된 프로필을 불러오지 못했습니다.');
          return;
        }

        if (!data.authenticated) {
          setProfileLoadStatus('anonymous');
          return;
        }

        const options = buildSavedProfileOptions(data);
        setSavedProfileOptions(options);
        setProfileLoadStatus(options.length > 0 ? 'ready' : 'empty');

        const autoProfileParam =
          typeof window === 'undefined'
            ? null
            : new URLSearchParams(window.location.search).get('autoProfile');
        const shouldAutoApplyProfile =
          autoProfileParam === '1' ||
          autoProfileParam === 'true' ||
          autoProfileParam === 'signup' ||
          !hasReusableBirthDraft(form);
        const selfProfile = options.find((profile) => profile.source === 'self');

        if (shouldAutoApplyProfile && selfProfile && !hasAutoAppliedProfileRef.current) {
          hasAutoAppliedProfileRef.current = true;
          applySavedProfile(selfProfile);
          setProfileLoadMessage('로그인된 내 정보를 입력칸에 자동으로 불러왔습니다.');
          if (autoProfileParam) {
            window.history.replaceState(null, '', '/saju/new');
          }
        }
      } catch {
        if (cancelled) return;
        setProfileLoadStatus('error');
        setProfileLoadMessage('저장된 프로필을 불러오는 중 네트워크 오류가 발생했습니다.');
      }
    }

    void loadSavedProfiles();

    return () => {
      cancelled = true;
    };
  }, [isHydrated]);

  function markBirthStarted(source: 'manual' | 'profile' | 'recent') {
    if (hasTrackedBirthStartRef.current) return;
    trackMoonlightEvent('birth_form_started', {
      from: 'saju-new',
      source,
      layout: 'swipe',
    });
    hasTrackedBirthStartRef.current = true;
  }

  function updateBirthLocation(code: string) {
    markBirthStarted('manual');
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
    setForm((current) =>
      applyUnifiedBirthPatch(current, {
        birthLocationCode: code,
        birthLocationLabel:
          code === 'custom' ? current.birthLocationLabel : preset?.label ?? '',
        birthLatitude:
          code === 'custom' ? current.birthLatitude : preset ? String(preset.latitude) : '',
        birthLongitude:
          code === 'custom' ? current.birthLongitude : preset ? String(preset.longitude) : '',
      })
    );
    setLocationSearchStatus('idle');
    setLocationSearchMessage('');
    setLocationSearchResults([]);
  }

  async function searchBirthLocationCoordinates() {
    markBirthStarted('manual');
    const query = form.birthLocationLabel.trim();
    if (query.length < 2) {
      setLocationSearchStatus('error');
      setLocationSearchMessage('지역명을 두 글자 이상 입력해 주세요.');
      setLocationSearchResults([]);
      return;
    }

    setLocationSearchStatus('loading');
    setLocationSearchMessage('');
    setLocationSearchResults([]);

    try {
      const response = await fetch(`/api/geo/birth-location?q=${encodeURIComponent(query)}`, {
        cache: 'force-cache',
      });
      const data = (await response.json().catch(() => null)) as BirthLocationSearchResponse | null;

      if (!response.ok || !data?.ok) {
        setLocationSearchStatus('error');
        setLocationSearchMessage(data?.error ?? '지역 좌표를 찾지 못했습니다.');
        return;
      }

      const items = data.items ?? [];
      setLocationSearchResults(items);
      setLocationSearchStatus(items.length > 0 ? 'ready' : 'empty');
      setLocationSearchMessage(
        items.length > 0
          ? '가장 가까운 지역을 골라 위도와 경도를 적용해 주세요.'
          : '검색 결과가 없습니다. 시/군/구 이름이나 영문 지명을 함께 입력해 보세요.'
      );
    } catch {
      setLocationSearchStatus('error');
      setLocationSearchMessage('지역 좌표를 찾는 중 네트워크 오류가 발생했습니다.');
    }
  }

  function applyBirthLocationSearchResult(result: BirthLocationSearchResultLike) {
    markBirthStarted('manual');
    setForm((current) =>
      applyUnifiedBirthPatch(current, {
        birthLocationCode: 'custom',
        birthLocationLabel: result.label,
        birthLatitude: String(result.latitude),
        birthLongitude: String(result.longitude),
      })
    );
    setLocationSearchStatus('ready');
    setLocationSearchMessage(`${result.label} 좌표를 적용했습니다.`);
    setLocationSearchResults([]);
  }

  function applySavedProfile(profile: SavedBirthProfile) {
    markBirthStarted('profile');
    setForm((current) => ({
      ...current,
      calendarType: profile.calendarType,
      timeRule: profile.timeRule,
      year: String(profile.birthYear),
      month: String(profile.birthMonth),
      day: String(profile.birthDay),
      hour: profile.birthHour === null ? '' : String(profile.birthHour),
      minute:
        profile.birthHour === null || profile.birthMinute === null
          ? ''
          : String(profile.birthMinute),
      birthLocationCode: profile.birthLocationCode,
      birthLocationLabel: profile.birthLocationLabel,
      birthLatitude: profile.birthLatitude === null ? '' : String(profile.birthLatitude),
      birthLongitude: profile.birthLongitude === null ? '' : String(profile.birthLongitude),
      solarTimeMode: profile.birthLocationCode ? profile.solarTimeMode : 'standard',
      jasiMethod: 'unified',
      gender: profile.gender ?? '',
      nickname: profile.nickname || current.nickname,
      loadedProfileSource: profile.source,
    }));
    setErrorMessage('');
    setProfileLoadMessage(
      profile.source === 'family'
        ? `${profile.label} 가족 프로필을 불러왔습니다. 결과를 열어도 내 정보는 바뀌지 않습니다.`
        : `${profile.label} 정보를 입력칸에 불러왔습니다.`
    );
    // 2026-05-15 — 순서 재배치 이후 마지막 = profile (concern picker). 데이터 불러온 후
    // 사용자가 concern 만 선택하면 제출 가능. consentStepIndex === profileStepIndex.
    setActiveIndex(profileStepIndex);
  }

  function applyRecentGuestInput() {
    if (!recentGuestDraft || !hasCompleteRecentGuestInput(recentGuestDraft)) return;

    markBirthStarted('recent');
    setForm((current) => ({
      ...recentGuestDraft,
      focusTopic: current.focusTopic,
      tone: current.tone,
      consents: current.consents,
      loadedProfileSource: 'manual',
    }));
    setErrorMessage('');
    setProfileLoadMessage('이 기기에 남아 있던 최근 정보를 입력칸에 불러왔습니다.');
    // 2026-05-15 — 순서 재배치 이후 마지막 = profile (concern picker). 데이터 불러온 후
    // 사용자가 concern 만 선택하면 제출 가능. consentStepIndex === profileStepIndex.
    setActiveIndex(profileStepIndex);
  }

  function removeRecentGuestInput() {
    clearRecentGuestInput();
    setRecentGuestDraft(null);
    setProfileLoadMessage('이 기기에 남아 있던 최근 정보를 지웠습니다.');
  }

  function validateBirthStep() {
    if (form.gender !== 'male' && form.gender !== 'female') {
      setErrorMessage('성별까지 선택해 주세요.');
      return false;
    }

    const parsed = resolveUnifiedBirthInput(buildUnifiedBirthDraft(form), {
      requireGender: true,
    });

    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return false;
    }

    setErrorMessage('');
    return true;
  }

  function validateLocationStep() {
    if (!form.birthLocationCode) {
      setErrorMessage('출생지를 선택하거나 지역명을 검색해 좌표를 적용해 주세요.');
      return false;
    }

    const parsed = resolveUnifiedBirthInput(buildUnifiedBirthDraft(form), {
      requireGender: true,
    });

    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return false;
    }

    setErrorMessage('');
    return true;
  }

  // validateConsentStep 제거됨 — Redesign 2026-05-13: 별도 consent step 폐지.

  async function submit() {
    // Redesign 2026-05-13: 필수 동의는 CTA 하단 disclosure 로 명시되어 있으므로 클릭=동의로 처리.
    // 폼 state 의 consents 도 일괄 true 로 채워 저장 시 동기화.
    if (!consentAccepted) {
      setForm((current) => ({
        ...current,
        consents: ONBOARDING_CONSENTS.reduce(
          (acc, item) => {
            acc[item.title] = item.required ? true : current.consents[item.title] ?? false;
            return acc;
          },
          { ...current.consents } as Record<string, boolean>
        ),
      }));
    }

    const parsed = resolveUnifiedBirthInput(buildUnifiedBirthDraft(form), {
      requireGender: true,
    });

    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return;
    }

    const readingInput = {
      ...parsed.input,
      name: form.nickname.trim() || undefined,
    };
    // 2026-05-15 PR 1: 사용자 현재 상황(연애/직업/고민) 을 같이 보내 personalizationContext 에 흐르게 함.
    const userSituation = toUserSituation(form);

    setIsSubmitting(true);
    setErrorMessage('');
    let didNavigate = false;
    // PR #154 — 12간지 로딩 모션 최소 노출 시간 가드.
    // 풀이가 너무 빨리 끝나도 모션을 못 보고 사라지지 않게 (~1 cycle 절반).
    const MIN_LOADING_MS = 1800;
    const loadingStartedAt = Date.now();

    try {
      const response = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...readingInput, userSituation }),
      });

      const data = await response.json();
      if (!response.ok || !data.id) {
        setErrorMessage(data.error ?? '사주 결과를 생성하지 못했습니다.');
        return;
      }

      if (!consentAccepted) {
        saveAcceptedRequiredConsents();
        setConsentAccepted(true);
      }

      trackMoonlightEvent('birth_form_completed', {
        from: 'saju-new',
        sourceSessionId: data.id,
        focusTopic: form.focusTopic,
        calendarType: form.calendarType,
        timeRule: form.timeRule,
        unknownBirthTime: readingInput.unknownTime,
        layout: 'swipe',
      });

      if (form.loadedProfileSource !== 'family') {
        saveRecentGuestInput(form);
      }
      clearOnboardingDraft();
      if (shouldAutoSavePersonalProfile(form.loadedProfileSource)) {
        void fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: form.nickname.trim() || '나',
            calendarType: form.calendarType,
            timeRule: form.timeRule,
            unknownBirthTime: readingInput.unknownTime,
            birthYear: readingInput.year,
            birthMonth: readingInput.month,
            birthDay: readingInput.day,
            birthHour: readingInput.hour ?? null,
            birthMinute: readingInput.minute ?? null,
            birthLocationCode:
              readingInput.birthLocation?.code ?? form.birthLocationCode ?? null,
            birthLocationLabel: readingInput.birthLocation?.label ?? '',
            birthLatitude: readingInput.birthLocation?.latitude ?? null,
            birthLongitude: readingInput.birthLocation?.longitude ?? null,
            solarTimeMode: readingInput.solarTimeMode ?? 'standard',
            gender: readingInput.gender ?? null,
          }),
        }).catch(() => undefined);
      }

      // 2026-05-14: 결과 페이지가 prefetch 되도록 router.prefetch 호출 후 push.
      // didNavigate flag 로 finally 에서 isSubmitting 을 false 로 되돌리지 않도록 한다.
      // → 페이지 전환 완료(destination 마운트)까지 오버레이가 유지된다.
      const nextHref = buildPostSubmitHref(
        data.id,
        form.focusTopic,
        pendingProduct,
        pendingPlan
      );
      router.prefetch(nextHref);
      // PR #154 — 모션 최소 노출 시간 보장.
      {
        const elapsed = Date.now() - loadingStartedAt;
        if (elapsed < MIN_LOADING_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
        }
      }
      router.push(nextHref);
      didNavigate = true;
      return;
    } catch {
      const fallbackId = toSlug(readingInput);
      if (!consentAccepted) {
        saveAcceptedRequiredConsents();
        setConsentAccepted(true);
      }
      trackMoonlightEvent('birth_form_completed', {
        from: 'saju-new',
        sourceSessionId: fallbackId,
        focusTopic: form.focusTopic,
        calendarType: form.calendarType,
        timeRule: form.timeRule,
        unknownBirthTime: readingInput.unknownTime,
        layout: 'swipe',
      });
      if (form.loadedProfileSource !== 'family') {
        saveRecentGuestInput(form);
      }
      clearOnboardingDraft();
      const fallbackHref = buildPostSubmitHref(
        fallbackId,
        form.focusTopic,
        pendingProduct,
        pendingPlan
      );
      router.prefetch(fallbackHref);
      // PR #154 — 모션 최소 노출 시간 보장 (실패 경로도 동일).
      {
        const elapsed = Date.now() - loadingStartedAt;
        if (elapsed < MIN_LOADING_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
        }
      }
      router.push(fallbackHref);
      didNavigate = true;
      return;
    } finally {
      // 정상/폴백 push 모두 didNavigate=true → 오버레이 유지.
      // validation/api 오류로 setErrorMessage 후 return 한 경우에만 false 로 복귀.
      if (!didNavigate) {
        setIsSubmitting(false);
      }
    }
  }

  function goNext() {
    if (activeStep.id === 'birth' && !validateBirthStep()) return;
    if (activeStep.id === 'location' && !validateLocationStep()) return;

    // 2026-05-15 — 순서 재배치 (birth → location → profile) 이후 마지막 step = profile.
    // profile (concern picker) 은 선택사항이지만 제출 트리거 단계.
    if (activeStep.id === 'profile') {
      void submit();
      return;
    }

    setActiveIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function goPrev() {
    setErrorMessage('');
    setActiveIndex((current) => Math.max(0, current - 1));
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;

    const delta = event.changedTouches[0]?.clientX - start;
    if (Math.abs(delta) < 54) return;
    if (delta < 0) goNext();
    if (delta > 0) goPrev();
  }

  function selectEntryTopic(entry: (typeof QUESTION_ENTRY_POINTS)[number]) {
    const focusTopic = ENTRY_FOCUS_TOPIC_BY_SLUG[entry.slug];
    setSelectedEntrySlug(entry.slug);
    setForm((current) => ({
      ...current,
      focusTopic,
    }));
    trackMoonlightEvent('birth_form_started', {
      from: 'saju-new-question',
      focus: entry.slug,
      focusTopic,
      layout: 'swipe',
    });
  }

  // Redesign 2026-05-13: mockup screens-a.jsx ScreenSajuIntake 시각 그대로.
  // 이름(별칭) + 생년월일 inputs + 양력/음력 chips + 시각 ZodiacChip card + 성별 buttons.
  function renderBirthStep() {
    const hourBranch = getHourBranch(form.hour);
    const isHourUnknown = form.hour === '';

    const inputCls =
      'h-12 w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]';

    return (
      <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-5">
        <div>
          <label
            htmlFor="saju-nickname"
            className="block text-[12.5px] font-medium text-[var(--app-copy-muted)]"
          >
            이름 (별칭)
          </label>
          <input
            id="saju-nickname"
            type="text"
            value={form.nickname}
            onChange={(event) =>
              setForm((current) => ({ ...current, nickname: event.target.value }))
            }
            placeholder="달빛이"
            autoComplete="name"
            className={cn('mt-1.5', inputCls)}
          />
        </div>

        <div>
          <label className="block text-[12.5px] font-medium text-[var(--app-copy-muted)]">
            생년월일
          </label>
          <div className="mt-1.5 grid grid-cols-[1.2fr_1fr_1fr] gap-2">
            <input
              value={form.year}
              onChange={(event) =>
                setForm((current) =>
                  applyUnifiedBirthPatch(current, {
                    year: event.target.value,
                    month: current.month,
                    day: current.day,
                  })
                )
              }
              placeholder="1995"
              inputMode="numeric"
              maxLength={4}
              aria-label="출생 연도"
              className={cn('text-center', inputCls)}
            />
            <input
              value={form.month}
              onChange={(event) =>
                setForm((current) =>
                  applyUnifiedBirthPatch(current, {
                    year: current.year,
                    month: event.target.value,
                    day: current.day,
                  })
                )
              }
              placeholder="08"
              inputMode="numeric"
              maxLength={2}
              aria-label="출생 월"
              className={cn('text-center', inputCls)}
            />
            <input
              value={form.day}
              onChange={(event) =>
                setForm((current) =>
                  applyUnifiedBirthPatch(current, {
                    year: current.year,
                    month: current.month,
                    day: event.target.value,
                  })
                )
              }
              placeholder="14"
              inputMode="numeric"
              maxLength={2}
              aria-label="출생 일"
              className={cn('text-center', inputCls)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { v: 'solar', l: '양력' },
              { v: 'lunar', l: '음력' },
            ].map((opt) => {
              const active = form.calendarType === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      applyUnifiedBirthPatch(current, {
                        calendarType: opt.v as 'solar' | 'lunar',
                      })
                    )
                  }
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
                    active
                      ? 'border-transparent bg-[var(--app-pink)] text-white'
                      : 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]'
                  )}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[12.5px] font-medium text-[var(--app-copy-muted)]">
            태어난 시각
          </label>
          <div
            className="relative mt-1.5 flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] p-3.5"
            style={{ background: 'var(--app-pink-soft)' }}
          >
            {hourBranch ? (
              <>
                <ZodiacChip kind={hourBranch.zodiac} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[var(--app-ink)]">
                    {Number.parseInt(form.hour, 10)}시 ({hourBranch.label})
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
                    {hourBranch.range}
                  </div>
                </div>
                <span className="text-[14px] font-extrabold text-[var(--app-pink-strong)]">
                  변경
                </span>
              </>
            ) : (
              <>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[var(--app-line)] bg-white text-[18px] font-bold text-[var(--app-copy-muted)]"
                  aria-hidden="true"
                >
                  ?
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[var(--app-ink)]">시간 모름</div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
                    탭하여 출생 시간을 선택하세요
                  </div>
                </div>
                <span className="text-[14px] font-extrabold text-[var(--app-pink-strong)]">
                  변경
                </span>
              </>
            )}
            <select
              value={form.hour}
              onChange={(event) =>
                setForm((current) =>
                  applyUnifiedBirthPatch(current, {
                    hour: event.target.value,
                    unknownBirthTime: event.target.value === '',
                  })
                )
              }
              aria-label="태어난 시간 선택"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">시간 모름</option>
              {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                <option key={h} value={String(h)}>
                  {String(h).padStart(2, '0')}시
                </option>
              ))}
            </select>
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[13px] text-[var(--app-copy-muted)]">
            <input
              type="checkbox"
              checked={isHourUnknown}
              onChange={(event) =>
                setForm((current) =>
                  applyUnifiedBirthPatch(current, {
                    unknownBirthTime: event.target.checked,
                    hour: event.target.checked ? '' : current.hour,
                    minute: event.target.checked ? '' : current.minute,
                  })
                )
              }
              className="h-4 w-4 rounded border-[var(--app-line)] accent-[var(--app-pink)]"
            />
            태어난 시간을 정확히 모르겠어요
          </label>
        </div>

        <div>
          <label className="block text-[12.5px] font-medium text-[var(--app-copy-muted)]">
            성별
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {[
              { v: 'female', l: '여성' },
              { v: 'male', l: '남성' },
            ].map((opt) => {
              const active = form.gender === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      applyUnifiedBirthPatch(current, {
                        gender: opt.v as 'female' | 'male',
                      })
                    )
                  }
                  className={cn(
                    'h-12 rounded-[14px] border text-[14.5px] font-bold transition',
                    active
                      ? 'border-[var(--app-pink)] bg-[var(--app-pink)] text-white'
                      : 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]'
                  )}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderProfileStep() {
    return (
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUESTION_ENTRY_POINTS.map((entry) => {
            const isSelected = selectedEntrySlug === entry.slug;

            return (
              <button
                key={entry.slug}
                type="button"
                onClick={() => selectEntryTopic(entry)}
                data-selected={isSelected ? 'true' : 'false'}
                className={cn(
                  'group rounded-full border px-3 py-2 text-center text-sm font-semibold transition-colors sm:px-4 sm:py-2.5',
                  isSelected
                    ? 'border-[var(--app-pink)]/42 bg-[var(--app-pink)]/10'
                    : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] hover:border-[var(--app-pink)]/30 hover:bg-[var(--app-pink)]/8'
                )}
              >
                <span className={isSelected ? 'text-[var(--app-ink)]' : 'text-[var(--app-copy)]'}>
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-[1.05rem] border border-[var(--app-pink)]/18 bg-[var(--app-pink)]/8 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--app-ink)]">
                {selectedEntryPoint.question}
              </div>
              <p className="mt-1.5 text-sm leading-6 text-[var(--app-copy)]">
                {selectedEntryPoint.reportAnswer}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-[var(--app-pink)]/22 bg-[var(--app-pink)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--app-pink-strong)]">
              선택됨
            </span>
          </div>
        </div>

        {/* 2026-05-16 PR #147 — 현재 상황 입력 hero 카드 (항상 펼침).
            기존: <details> 접힘 → 사용자가 지나치고 입력률 낮음.
            변경: pink-soft gradient hero + 가치 명시 ("정확도 ↑") + live preview chip strip. */}
        <section
          className="rounded-[1.05rem] border p-4"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                <span aria-hidden="true">🎯</span>
                <span>맞춤 풀이를 위해</span>
              </div>
              <h3 className="mt-1 text-[15px] font-extrabold leading-snug text-[var(--app-ink)]">
                지금 내 상황을 알려주세요
              </h3>
            </div>
            <span
              className="shrink-0 rounded-full border bg-white px-2.5 py-1 text-[10px] font-extrabold text-[var(--app-pink-strong)]"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              정확도 ↑
            </span>
          </div>
          <p
            className="mt-1.5 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            연애·직업·고민을 골라주시면, 사주 풀이와 오늘의 운세가{' '}
            <strong className="text-[var(--app-pink-strong)]">본인 상황에 맞춘 호명</strong>으로
            바뀝니다. 미입력해도 일반 풀이는 제공돼요.
          </p>

          {/* live preview chip strip — 입력한 값들이 어떻게 풀이에 반영될지 즉시 보여줌 */}
          {(() => {
            const previewItems: Array<{ key: string; emoji: string; label: string }> = [];
            const rel = RELATIONSHIP_PREVIEW[form.relationshipStatus];
            const occ = OCCUPATION_PREVIEW[form.occupation];
            const con = CONCERN_PREVIEW[form.currentConcern];
            if (rel) previewItems.push({ key: 'rel', emoji: rel.emoji, label: rel.label });
            if (occ) previewItems.push({ key: 'occ', emoji: occ.emoji, label: occ.label });
            if (con) {
              const concernLabel =
                form.currentConcern === 'other' && form.concernNote.trim()
                  ? form.concernNote.trim().slice(0, 18)
                  : con.label;
              previewItems.push({ key: 'con', emoji: con.emoji, label: concernLabel });
            }
            if (previewItems.length === 0) {
              return (
                <div
                  className="mt-3 rounded-[10px] border-2 border-dashed bg-white/60 px-3 py-2.5 text-center text-[11px] text-[var(--app-copy-muted)]"
                  style={{ borderColor: 'var(--app-pink-line)' }}
                >
                  ↓ 아래에서 골라주시면 여기 미리보기가 나타나요
                </div>
              );
            }
            return (
              <div
                className="mt-3 rounded-[12px] border bg-white px-3 py-2.5"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  ✓ 이 풀이에 반영될 정보
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {previewItems.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--app-pink-soft)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-pink-strong)] border"
                      style={{ borderColor: 'var(--app-pink-line)' }}
                    >
                      <span aria-hidden="true">{item.emoji}</span>
                      <span>{item.label}</span>
                    </span>
                  ))}
                </div>
                <p
                  className="mt-1.5 text-[10.5px] leading-[1.4] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  사주 결과의 hero 영역과 본문, 오늘의 운세 영역별 점수에 자동 반영돼요.
                </p>
              </div>
            );
          })()}

          <div className="mt-4 grid gap-3.5 rounded-[12px] bg-white px-3.5 py-3.5">
            <SituationChipGroup
              label="현재 관계"
              icon="💑"
              value={form.relationshipStatus}
              onChange={(next) => setForm((prev) => ({ ...prev, relationshipStatus: next }))}
              options={[
                { value: 'single', label: '솔로', emoji: '💛' },
                { value: 'dating', label: '연애 중', emoji: '💑' },
                { value: 'married', label: '기혼', emoji: '💍' },
                { value: 'separated', label: '이별·정리 중', emoji: '🍂' },
              ]}
            />
            <SituationChipGroup
              label="현재 하시는 일"
              icon="💼"
              value={form.occupation}
              onChange={(next) => setForm((prev) => ({ ...prev, occupation: next }))}
              options={[
                { value: 'employee', label: '직장인', emoji: '💼' },
                { value: 'self-employed', label: '자영업·프리랜서', emoji: '🛠' },
                { value: 'student', label: '학생', emoji: '📚' },
                { value: 'homemaker', label: '주부', emoji: '🏠' },
                { value: 'job-seeking', label: '구직 중', emoji: '🔎' },
                { value: 'other', label: '기타', emoji: '✨' },
              ]}
            />
            <SituationChipGroup
              label="요즘 가장 큰 고민"
              icon="💭"
              value={form.currentConcern}
              onChange={(next) => setForm((prev) => ({ ...prev, currentConcern: next }))}
              options={[
                { value: 'business', label: '사업·이직', emoji: '🚀' },
                { value: 'romance', label: '결혼·연애', emoji: '💞' },
                { value: 'family', label: '자녀·가족', emoji: '👨‍👩‍👧' },
                { value: 'health', label: '건강·멘탈', emoji: '🩺' },
                { value: 'wealth', label: '재물·투자', emoji: '💰' },
                { value: 'other', label: '직접 입력', emoji: '✍️' },
              ]}
            />
            {form.currentConcern === 'other' ? (
              <input
                type="text"
                value={form.concernNote}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, concernNote: event.target.value.slice(0, 80) }))
                }
                placeholder="고민을 짧게 적어주세요 (최대 80자)"
                className="motion-input-effect h-11 w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3 text-[13.5px] text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
              />
            ) : null}
          </div>
        </section>

        {recentGuestDraft ? (
          <div className="rounded-[1.1rem] border border-[var(--app-pink)]/28 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(17,17,20,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--app-ink)]">최근 입력한 정보가 있어요</div>
                <p className="mt-1.5 text-sm leading-6 text-[var(--app-copy-muted)]">
                  로그인하지 않아도 같은 브라우저에서는 다시 입력하지 않도록 이 기기에만 기억합니다.
                </p>
              </div>
              <span className="rounded-full border border-[var(--app-pink)]/24 bg-[var(--app-pink)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--app-pink-strong)]">
                로컬 저장
              </span>
            </div>
            <div className="mt-3 rounded-[0.9rem] border border-[var(--app-line)] bg-white px-3 py-2.5 text-xs leading-6 text-[var(--app-copy)]">
              {recentGuestDetail}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={applyRecentGuestInput} size="sm">
                최근 정보로 이어보기
              </Button>
              <Button
                type="button"
                onClick={removeRecentGuestInput}
                variant="secondary"
                size="sm"
              >
                이 기기에서 지우기
              </Button>
            </div>
          </div>
        ) : null}

        {profileLoadStatus === 'loading' ? (
          <div className="rounded-[1.1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-copy-muted)]">
            저장된 내 정보와 등록한 사람을 확인하고 있습니다.
          </div>
        ) : null}

        {profileLoadStatus === 'anonymous' ? (
          <div className="rounded-[1.1rem] border border-[var(--app-pink)]/18 bg-[var(--app-pink)]/8 px-4 py-4">
            <div className="text-sm font-medium text-[var(--app-ink)]">비로그인으로도 바로 볼 수 있습니다</div>
            <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">
              {recentGuestDraft
                ? '지금은 새 정보를 직접 입력하거나, 이 기기에 남아 있는 최근 정보를 불러올 수 있습니다.'
                : '저장은 나중에 해도 됩니다. 먼저 사주풀이를 열어보세요.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setActiveIndex(birthStepIndex)}
                size="sm"
              >
                새 정보 입력
              </Button>
              <Link
                href="/login?next=/saju/new"
                className="gangi-secondary-button"
              >
                로그인
              </Link>
            </div>
          </div>
        ) : null}

        {profileLoadStatus === 'empty' ? (
          <div className="rounded-[1.1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4">
            <div className="text-sm font-medium text-[var(--app-ink)]">아직 저장된 정보가 없습니다</div>
            <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">
              이번에 입력한 정보는 다음부터 바로 불러올 수 있게 저장됩니다.
            </p>
          </div>
        ) : null}

        {profileLoadStatus === 'error' ? (
          <div className="rounded-[1.1rem] border border-[var(--app-coral)]/28 bg-[var(--app-coral)]/10 px-4 py-4 text-sm leading-6 text-rose-700">
            {profileLoadMessage}
          </div>
        ) : null}

        {profileLoadStatus === 'ready' ? (
          <div className="max-h-[min(42vh,22rem)] overflow-y-auto pr-1">
            <ProductGrid columns={2}>
              {savedProfileOptions.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => applySavedProfile(profile)}
                  className="app-feature-card-soft text-left transition-colors hover:border-[var(--app-pink)]/38 hover:bg-[var(--app-pink)]/8"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-sm font-medium text-[var(--app-ink)]">{profile.label}</div>
                    <span className="shrink-0 rounded-full border border-[var(--app-pink)]/22 bg-[var(--app-pink)]/8 px-2 py-0.5 text-[10px] text-[var(--app-pink-strong)]">
                      선택
                    </span>
                  </div>
                  <div className="mt-2 text-xs leading-6 text-[var(--app-copy-muted)]">{profile.detail}</div>
                </button>
              ))}
            </ProductGrid>
          </div>
        ) : null}

        {profileLoadMessage && profileLoadStatus !== 'error' ? (
          <p className="rounded-full border border-[var(--app-pink)]/18 bg-[var(--app-pink)]/8 px-3 py-2 text-xs leading-5 text-[var(--app-pink-strong)]">
            {profileLoadMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
          <span className="text-sm leading-6 text-[var(--app-copy-muted)]">새 생년월일로 보려면 직접 입력하세요.</span>
          <Button
            type="button"
            onClick={() => setActiveIndex(birthStepIndex)}
            variant="secondary"
            size="sm"
          >
            직접 입력
          </Button>
        </div>
      </div>
    );
  }

  // Redesign 2026-05-13: location 단계가 제출 단계. consent step 별도 라벨 제거.
  const nextLabel =
    activeStep.id === 'profile'
      ? '바로 입력 시작'
      : activeStep.id === 'birth'
        ? '시간·출생지 입력'
        : activeStep.id === 'location'
          ? isSubmitting
            ? '결과 준비 중...'
            : '사주풀이 시작'
          : '다음 화면';
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      {isSubmitting ? (
        <ZodiacWheelLoading
          title="사주를 풀어드리고 있어요"
          description="네 기둥(年月日時)을 정리하고 오늘 흐름과 맞춰보는 중입니다."
        />
      ) : null}
      <AppPage className="gangi-subpage saju-intake-page space-y-4 sm:space-y-6">
        <GangiPageHeader title="사주 입력" />
        <GangiIntro
          title={
            <>
              사주를 보려면
              <br />
              이 정도면 충분해요
            </>
          }
          description="생년월일, 성별, 태어난 시간만 먼저 알려주세요."
        />

        <section className="grid gap-4 lg:gap-5">
          <SectionSurface surface="panel" size="lg" className="saju-intake-main-card overflow-hidden">
            {/* Redesign 2026-05-13 (Claude Design / screens-a.jsx ScreenSajuIntake): 3-bar step indicator */}
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
              <div
                className="flex min-w-0 flex-1 items-center gap-1.5"
                role="list"
                aria-label="진행 단계"
              >
                {steps.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (index <= activeIndex) {
                        setActiveIndex(index);
                        setErrorMessage('');
                      }
                    }}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all',
                      index <= activeIndex
                        ? 'bg-[var(--app-pink)]'
                        : 'bg-[var(--app-line)]'
                    )}
                    aria-label={`${index + 1}단계 ${item.eyebrow}`}
                    aria-current={index === activeIndex ? 'step' : undefined}
                  />
                ))}
              </div>
              {consentAccepted ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 px-3 py-1 text-xs text-[var(--app-jade)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  동의 저장됨
                </span>
              ) : null}
            </div>

            <div
              className="overflow-hidden"
              onTouchStart={(event) => {
                touchStartXRef.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={handleTouchEnd}
            >
              <div key={activeStep.id} className="saju-intake-active-slide">
                <SectionHeader
                  eyebrow={`STEP ${activeIndex + 1} / ${steps.length} · ${activeStep.eyebrow}`}
                  title={activeStep.title}
                  titleClassName="text-2xl sm:text-3xl"
                  description={activeStep.description}
                  descriptionClassName="max-w-3xl text-sm text-[var(--app-copy)] sm:text-base"
                />

                {activeStep.id === 'profile' ? (
                  renderProfileStep()
                ) : activeStep.id === 'birth' ? (
                  renderBirthStep()
                ) : (
                  <div className="mt-4 sm:mt-6">
                    <UnifiedBirthInfoFields
                      draft={buildUnifiedBirthDraft(form)}
                      onChange={(patch) => setForm((current) => applyUnifiedBirthPatch(current, patch))}
                      onStarted={() => markBirthStarted('manual')}
                      dateInputVariant="select"
                      visibleSections={activeStep.sections}
                      hideTimePicker
                      locationLoading={locationSearchStatus === 'loading'}
                      locationMessage={locationSearchMessage}
                      locationResults={locationSearchResults}
                      onLocationSearch={searchBirthLocationCoordinates}
                      onPresetSelect={updateBirthLocation}
                      onLocationResultSelect={applyBirthLocationSearchResult}
                    />
                  </div>
                )}
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-6 rounded-[1.2rem] border border-[var(--app-coral)]/28 bg-[var(--app-coral)]/10 px-4 py-3 text-sm leading-7 text-[var(--app-ink)]">
                {errorMessage}
              </div>
            ) : null}

            {/* Redesign 2026-05-13 (Claude Design / screens-a.jsx): full-width pink CTA + secondary 이전 + footer note */}
            <div className="mt-5 flex flex-col gap-2.5 sm:mt-8">
              <Button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                size="lg"
                className="h-12 w-full rounded-[14px] text-[15px] font-extrabold"
              >
                {nextLabel}
                {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
              {activeIndex > 0 ? (
                <Button
                  type="button"
                  onClick={goPrev}
                  disabled={isSubmitting}
                  variant="ghost"
                  size="sm"
                  className="mx-auto h-9 px-4 text-[12.5px] font-medium text-[var(--app-copy-muted)] hover:text-[var(--app-pink-strong)]"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  이전 단계로
                </Button>
              ) : null}
              <p className="text-center text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
                결과는 자동으로 보관함에 저장돼요
              </p>
              {activeStep.id === 'location' && !consentAccepted ? (
                <p className="mt-1 text-center text-[10.5px] leading-relaxed text-[var(--app-copy-soft)]">
                  시작 시 <LegalLinks className="text-[var(--app-pink-strong)]" />
                  과 AI 모델 전송에 동의합니다.
                </p>
              ) : null}
            </div>
          </SectionSurface>

        </section>
      </AppPage>
    </AppShell>
  );
}
