'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ActionCluster } from '@/components/layout/action-cluster';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  type OnboardingFocusTopic,
  type SajuOnboardingDraft,
} from './onboarding-storage';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export type OnboardingStep = 'empathy' | 'birth' | 'nickname' | 'consent';
type SwipeStepId = 'profile' | 'birth' | 'location' | 'consent';
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
  title: '먼저 무엇이 제일 궁금한지 고릅니다',
  description: '연애, 돈, 일, 가족, 올해 흐름 중 지금 마음에 걸리는 주제를 먼저 정하고 입력을 시작합니다.',
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
    title: '생년월일과 성별을 한 번에 고릅니다',
    description: '양력·음력, 연·월·일, 성별을 같은 화면에서 선택합니다.',
    sections: ['date', 'gender'],
  },
  {
    id: 'location',
    eyebrow: '출생지와 시간',
    title: '시간과 출생지를 맞추면 바로 열립니다',
    description: '시간을 모르면 시간 모름으로 진행할 수 있고, 출생지는 지역 버튼으로 빠르게 고를 수 있습니다.',
    sections: ['location-time'],
  },
];

const CONSENT_STEP = {
  id: 'consent' as const,
  eyebrow: '동의',
  title: '필수 동의만 확인합니다',
  description: '한 번 동의하면 다음 입력부터는 다시 표시하지 않습니다.',
};

const STEP_HINTS = [
  '생년월일과 성별을 한 화면에서 같이 선택합니다.',
  '저장된 정보나 최근 입력이 있으면 이름만 눌러 건너뜁니다.',
  '비로그인 최근 정보는 이 기기에만 남고 바로 지울 수 있습니다.',
  '동의는 한 번 저장되면 다음 입력부터 자동으로 건너뜁니다.',
] as const;

const FAST_PATH_STEPS = [
  ['1', '질문 선택', '지금 궁금한 문제를 먼저 고릅니다.'],
  ['2', '기본 정보', '생년월일과 성별을 한 번에 입력합니다.'],
  ['3', '시간·출생지', '시간을 모르면 시간 모름으로 열 수 있습니다.'],
] as const;

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

function buildPostSubmitHref(id: string, focusTopic: OnboardingFocusTopic, product: TasteProductId | null) {
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
  const touchStartXRef = useRef<number | null>(null);
  const hasTrackedStartRef = useRef(false);
  const hasTrackedBirthStartRef = useRef(false);

  const steps = useMemo(
    () => (consentAccepted ? [PROFILE_STEP, ...BASE_STEPS] : [PROFILE_STEP, ...BASE_STEPS, CONSENT_STEP]),
    [consentAccepted]
  );
  const activeStep = steps[activeIndex] ?? steps[0];
  const progressLabel = `${activeIndex + 1} / ${steps.length}`;
  const recentGuestDetail = recentGuestDraft ? formatRecentGuestDetail(recentGuestDraft) : '';
  const selectedEntryPoint =
    QUESTION_ENTRY_POINTS.find((entry) => entry.slug === selectedEntrySlug) ?? QUESTION_ENTRY_POINTS[0];
  const birthStepIndex = Math.max(1, steps.findIndex((item) => item.id === 'birth'));
  const locationStepIndex = Math.max(0, steps.findIndex((item) => item.id === 'location'));
  const consentStepIndex = steps.findIndex((item) => item.id === 'consent');

  useEffect(() => {
    const draft = loadOnboardingDraft();
    const recent = loadRecentGuestInput();
    const focusParam =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('focus');
    const productParam =
      typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('product');
    const initialFocusTopic = normalizeEntryFocusParam(focusParam);
    if (isTasteProductId(productParam)) {
      setPendingProduct(productParam);
      if (productParam === 'monthly-calendar' || productParam === 'year-core') {
        setSelectedEntrySlug('year');
      }
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
    setActiveIndex(consentAccepted ? locationStepIndex : Math.max(consentStepIndex, locationStepIndex));
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
    setActiveIndex(consentAccepted ? locationStepIndex : Math.max(consentStepIndex, locationStepIndex));
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

  function validateConsentStep() {
    const requiredConsentMissing = ONBOARDING_CONSENTS.some(
      (item) => item.required && !form.consents[item.title]
    );

    if (requiredConsentMissing) {
      setErrorMessage('필수 동의 항목을 확인해 주세요.');
      return false;
    }

    setErrorMessage('');
    return true;
  }

  async function submit() {
    if (!consentAccepted && !validateConsentStep()) return;

    const parsed = resolveUnifiedBirthInput(buildUnifiedBirthDraft(form), {
      requireGender: true,
    });

    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.input),
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
        unknownBirthTime: parsed.input.unknownTime,
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
            unknownBirthTime: parsed.input.unknownTime,
            birthYear: parsed.input.year,
            birthMonth: parsed.input.month,
            birthDay: parsed.input.day,
            birthHour: parsed.input.hour ?? null,
            birthMinute: parsed.input.minute ?? null,
            birthLocationCode:
              parsed.input.birthLocation?.code ?? form.birthLocationCode ?? null,
            birthLocationLabel: parsed.input.birthLocation?.label ?? '',
            birthLatitude: parsed.input.birthLocation?.latitude ?? null,
            birthLongitude: parsed.input.birthLocation?.longitude ?? null,
            solarTimeMode: parsed.input.solarTimeMode ?? 'standard',
            gender: parsed.input.gender ?? null,
          }),
        }).catch(() => undefined);
      }

      router.push(buildPostSubmitHref(data.id, form.focusTopic, pendingProduct));
    } catch {
      const fallbackId = toSlug(parsed.input);
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
        unknownBirthTime: parsed.input.unknownTime,
        layout: 'swipe',
      });
      if (form.loadedProfileSource !== 'family') {
        saveRecentGuestInput(form);
      }
      clearOnboardingDraft();
      router.push(buildPostSubmitHref(fallbackId, form.focusTopic, pendingProduct));
    } finally {
      setIsSubmitting(false);
    }
  }

  function goNext() {
    if (activeStep.id === 'birth' && !validateBirthStep()) return;
    if (activeStep.id === 'location' && !validateLocationStep()) return;

    if (activeStep.id === 'location' && consentAccepted) {
      void submit();
      return;
    }

    if (activeStep.id === 'consent') {
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

  function renderProfileStep() {
    return (
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
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
                    ? 'border-[var(--app-gold)]/42 bg-[var(--app-gold)]/10'
                    : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] hover:border-[var(--app-gold)]/30 hover:bg-[var(--app-gold)]/8'
                )}
              >
                <span className={isSelected ? 'text-[var(--app-ivory)]' : 'text-[var(--app-copy)]'}>
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-[1.05rem] border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--app-ivory)]">
                {selectedEntryPoint.question}
              </div>
              <p className="mt-1.5 text-sm leading-6 text-[var(--app-copy)]">
                {selectedEntryPoint.reportAnswer}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-[var(--app-gold)]/22 bg-[var(--app-gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--app-gold-text)]">
              선택됨
            </span>
          </div>
        </div>

        {recentGuestDraft ? (
          <div className="rounded-[1.1rem] border border-[var(--app-gold)]/28 bg-[linear-gradient(135deg,rgba(210,176,114,0.14),rgba(255,255,255,0.035))] px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--app-ivory)]">최근 입력한 정보가 있어요</div>
                <p className="mt-1.5 text-sm leading-6 text-[var(--app-copy-muted)]">
                  로그인하지 않아도 같은 브라우저에서는 다시 입력하지 않도록 이 기기에만 기억합니다.
                </p>
              </div>
              <span className="rounded-full border border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--app-gold-text)]">
                로컬 저장
              </span>
            </div>
            <div className="mt-3 rounded-[0.9rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-3 py-2.5 text-xs leading-6 text-[var(--app-copy)]">
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
          <div className="rounded-[1.1rem] border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 px-4 py-4">
            <div className="text-sm font-medium text-[var(--app-ivory)]">비로그인으로도 바로 볼 수 있습니다</div>
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
                className="moon-action-secondary moon-action-compact"
              >
                로그인
              </Link>
            </div>
          </div>
        ) : null}

        {profileLoadStatus === 'empty' ? (
          <div className="rounded-[1.1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4">
            <div className="text-sm font-medium text-[var(--app-ivory)]">아직 저장된 정보가 없습니다</div>
            <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">
              이번에 입력한 정보는 다음부터 바로 불러올 수 있게 저장됩니다.
            </p>
          </div>
        ) : null}

        {profileLoadStatus === 'error' ? (
          <div className="rounded-[1.1rem] border border-[var(--app-coral)]/28 bg-[var(--app-coral)]/10 px-4 py-4 text-sm leading-6 text-rose-100">
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
                  className="app-feature-card-soft text-left transition-colors hover:border-[var(--app-gold)]/38 hover:bg-[var(--app-gold)]/8"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-sm font-medium text-[var(--app-ivory)]">{profile.label}</div>
                    <span className="shrink-0 rounded-full border border-[var(--app-gold)]/22 bg-[var(--app-gold)]/8 px-2 py-0.5 text-[10px] text-[var(--app-gold-text)]">
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
          <p className="rounded-full border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 px-3 py-2 text-xs leading-5 text-[var(--app-gold-text)]">
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

  const nextLabel =
    activeStep.id === 'profile'
      ? '바로 입력 시작'
      : activeStep.id === 'birth'
        ? '시간·출생지 입력'
      : activeStep.id === 'location' && consentAccepted
      ? isSubmitting
        ? '결과 준비 중...'
        : '사주풀이 열기'
      : activeStep.id === 'location'
        ? '마지막 동의 확인'
      : activeStep.id === 'consent'
        ? isSubmitting
          ? '결과 준비 중...'
          : '동의하고 사주풀이 열기'
        : '다음 화면';

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-0">
      <AppPage className="saju-intake-page space-y-4 sm:space-y-6">
        <PageHero
          className="saju-intake-hero"
          badges={[
            <Badge
              key="count"
              className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              {progressLabel}
            </Badge>,
            <Badge
              key="layout"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              3단계 빠른 입력
            </Badge>,
          ]}
          title="질문을 고르고, 필요한 정보만 빠르게 입력합니다"
          description="생년월일과 성별을 한 화면에서 받고, 저장된 정보나 최근 입력이 있으면 더 빨리 결과로 이어집니다."
        />

        <section className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr] lg:gap-6">
          <SectionSurface surface="panel" size="lg" className="saju-intake-main-card overflow-hidden">
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                      'h-2.5 rounded-full transition-all',
                      index === activeIndex
                        ? 'w-10 bg-[var(--app-gold)]'
                        : index < activeIndex
                          ? 'w-5 bg-[var(--app-gold)]/48'
                          : 'w-5 bg-[var(--app-line)]'
                    )}
                    aria-label={`${index + 1}단계 ${item.eyebrow}`}
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
                  eyebrow={activeStep.eyebrow}
                  title={activeStep.title}
                  titleClassName="text-2xl sm:text-3xl"
                  description={activeStep.description}
                  descriptionClassName="max-w-3xl text-sm text-[var(--app-copy)] sm:text-base"
                />

                {activeStep.id === 'profile' ? (
                  renderProfileStep()
                ) : activeStep.id === 'consent' ? (
                  <div className="mt-4 space-y-2.5 sm:mt-6 sm:space-y-3">
                    {ONBOARDING_CONSENTS.map((consent) => (
                      <label
                        key={consent.title}
                        className="flex items-start gap-3 rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3.5 py-3 sm:rounded-[1.25rem] sm:px-4 sm:py-4"
                      >
                        <input
                          type="checkbox"
                          checked={form.consents[consent.title]}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              consents: {
                                ...current.consents,
                                [consent.title]: event.target.checked,
                              },
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-[var(--app-line)] bg-transparent accent-[var(--app-gold)]"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium text-[var(--app-ivory)]">
                            {consent.title}
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px]',
                                consent.required
                                  ? 'border-[var(--app-coral)]/28 bg-[var(--app-coral)]/10 text-[var(--app-coral)]'
                                  : 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]'
                              )}
                            >
                              {consent.required ? '필수' : '선택'}
                            </span>
                          </span>
                          <span className="mt-1.5 block text-xs leading-5 text-[var(--app-copy-muted)] sm:mt-2 sm:leading-6">
                            {consent.detail}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 sm:mt-6">
                    <UnifiedBirthInfoFields
                      draft={buildUnifiedBirthDraft(form)}
                      onChange={(patch) => setForm((current) => applyUnifiedBirthPatch(current, patch))}
                      onStarted={() => markBirthStarted('manual')}
                      dateInputVariant="select"
                      visibleSections={activeStep.sections}
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
              <div className="mt-6 rounded-[1.2rem] border border-[var(--app-coral)]/28 bg-[var(--app-coral)]/10 px-4 py-3 text-sm leading-7 text-[var(--app-ivory)]">
                {errorMessage}
              </div>
            ) : null}

            <ActionCluster className="mt-5 sm:mt-8">
              <Button
                type="button"
                onClick={goPrev}
                disabled={activeIndex === 0 || isSubmitting}
                variant="secondary"
                size="lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                이전
              </Button>
              <Button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                size="lg"
              >
                {nextLabel}
                {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </ActionCluster>
          </SectionSurface>

          <SectionSurface surface="lunar" size="lg">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="빠른 시작"
              title="입력은 짧게, 풀이는 바로 이어갑니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="저장된 정보가 없을 때도 세 흐름만 지나면 결과 화면으로 넘어갑니다."
            />

            <div className="mt-6 grid gap-2.5">
              {FAST_PATH_STEPS.map(([number, title, body]) => (
                <div
                  key={title}
                  className="rounded-[1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-xs font-semibold text-[var(--app-gold-text)]">
                      {number}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--app-ivory)]">{title}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--app-copy-muted)]">{body}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1rem] border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 px-4 py-3 text-xs leading-5 text-[var(--app-gold-text)]">
              {STEP_HINTS[1]} {STEP_HINTS[2]}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/my/profile" className="app-top-action-link shrink-0">
                프로필 관리
              </Link>
              <Link
                href="/guide"
                className="moon-action-muted moon-action-compact"
              >
                입력 기준 보기
              </Link>
            </div>
          </SectionSurface>
        </section>
      </AppPage>
    </AppShell>
  );
}
