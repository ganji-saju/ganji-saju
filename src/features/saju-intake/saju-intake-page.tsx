'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { ActionCluster } from '@/components/layout/action-cluster';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
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
import { GangiIntro, GangiLoadingOverlay, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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

const CONSENT_STEP = {
  id: 'consent' as const,
  eyebrow: '동의',
  title: '동의하고 시작하기',
  description: '한 번 동의하면 다음 입력부터는 다시 표시하지 않습니다.',
};

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

  const steps = useMemo(
    () => (consentAccepted ? [PROFILE_STEP, ...BASE_STEPS] : [PROFILE_STEP, ...BASE_STEPS, CONSENT_STEP]),
    [consentAccepted]
  );
  const activeStep = steps[activeIndex] ?? steps[0];
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

    const readingInput = {
      ...parsed.input,
      name: form.nickname.trim() || undefined,
    };

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readingInput),
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

      router.push(buildPostSubmitHref(data.id, form.focusTopic, pendingProduct, pendingPlan));
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
      router.push(buildPostSubmitHref(fallbackId, form.focusTopic, pendingProduct, pendingPlan));
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
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      {isSubmitting ? (
        <GangiLoadingOverlay
          title="사주풀이를 준비하고 있어요"
          description="입력한 정보로 오늘 볼 흐름을 정리하는 중입니다."
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
                        ? 'w-10 bg-[var(--app-pink)]'
                        : index < activeIndex
                          ? 'w-5 bg-[var(--app-pink)]/48'
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
                          className="mt-1 h-4 w-4 rounded border-[var(--app-line)] bg-transparent accent-[var(--app-pink)]"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium text-[var(--app-ink)]">
                            {consent.title}
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px]',
                                consent.required
                                  ? 'border-[var(--app-coral)]/28 bg-[var(--app-coral)]/10 text-[var(--app-coral)]'
                                  : 'border-[var(--app-pink)]/28 bg-[var(--app-pink)]/10 text-[var(--app-pink-strong)]'
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
              <div className="mt-6 rounded-[1.2rem] border border-[var(--app-coral)]/28 bg-[var(--app-coral)]/10 px-4 py-3 text-sm leading-7 text-[var(--app-ink)]">
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

        </section>
      </AppPage>
    </AppShell>
  );
}
