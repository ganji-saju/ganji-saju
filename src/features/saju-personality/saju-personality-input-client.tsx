'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  estimatePersonalityType,
  getPersonalityTypeProfile,
  PERSONALITY_SELF_CHECK_QUESTIONS,
  PERSONALITY_TYPE_CODES,
  type PersonalityCheckAnswer,
  type PersonalityTypeCode,
} from '@/domain/personality';
import type { SajuPersonalityLifeArea } from '@/domain/saju-personality';
import {
  UnifiedBirthInfoFields,
  type BirthLocationSearchResultLike,
} from '@/components/saju/shared/unified-birth-info-fields';
import { AppPage as MoonlightAppPage } from '@/components/moonlight/AppPage';
import { AxisChipGrid } from '@/components/moonlight/AxisChipGrid';
import { ChoiceRow } from '@/components/moonlight/ChoiceRow';
import { FusionStrip } from '@/components/moonlight/FusionStrip';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { StepFlowShell } from '@/components/moonlight/StepFlowShell';
import { StickyActionBar } from '@/components/moonlight/StickyActionBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import { cn } from '@/lib/utils';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { AppShell } from '@/shared/layout/app-shell';
import { saveSajuPersonalityInputPayload } from './saju-personality-input-storage';

type ProfileLoadStatus = 'idle' | 'loading' | 'ready' | 'anonymous' | 'empty' | 'error';
type LocationSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type PersonalityInputMode = 'direct' | 'check';
type SajuPersonalityInputStep = 'profile' | 'personality' | 'lifeArea' | 'result';

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
  draft: UnifiedBirthEntryDraft;
}

interface LocationState {
  status: LocationSearchStatus;
  message: string;
  results: BirthLocationSearchResultLike[];
}

interface PersonalityState {
  mode: PersonalityInputMode;
  typeCode: PersonalityTypeCode | '';
  answers: PersonalityCheckAnswer[];
}

const LIFE_AREA_OPTIONS: Array<{
  value: SajuPersonalityLifeArea;
  label: string;
  description: string;
}> = [
  { value: 'basic', label: '기본 성향', description: '내 기질과 반복되는 선택 습관을 먼저 봅니다.' },
  { value: 'love', label: '연애', description: '마음이 열리는 속도와 표현 방식을 봅니다.' },
  { value: 'relationships', label: '인간관계', description: '편한 거리감과 대화 리듬을 봅니다.' },
  { value: 'work', label: '일', description: '몰입 조건과 일의 마무리 방식을 봅니다.' },
  { value: 'money_achievement', label: '돈/성취', description: '현실 감각과 성취 루틴을 봅니다.' },
  { value: 'year', label: '올해', description: '올해 붙잡을 성장 방향을 봅니다.' },
  { value: 'today', label: '오늘', description: '오늘 바로 실행할 작은 문장을 봅니다.' },
];

const SAJU_PERSONALITY_STEPS: Array<{
  key: SajuPersonalityInputStep;
  title: string;
  description: string;
}> = [
  {
    key: 'profile',
    title: '내 정보를 확인해 주세요',
    description: '저장된 프로필을 불러오거나 생년월일시를 새로 입력합니다.',
  },
  {
    key: 'personality',
    title: '16유형 성향을 알려 주세요',
    description: '직접 선택하거나 8문항 성향 체크로 가볍게 추정합니다.',
  },
  {
    key: 'lifeArea',
    title: '관심영역을 골라 주세요',
    description: '무료 결과에서 가장 먼저 보고 싶은 해석 초점을 선택합니다.',
  },
  {
    key: 'result',
    title: '무료 결과를 만들 준비가 됐어요',
    description: '입력한 내용을 확인하고 무료 성향사주 결과로 이동합니다.',
  },
];

const PERSONALITY_TYPE_ITEMS = PERSONALITY_TYPE_CODES.map((code) => {
  const profile = getPersonalityTypeProfile(code);

  return {
    id: code,
    label: code,
    value: profile.title,
  };
});

function createInitialDraft(): UnifiedBirthEntryDraft {
  return {
    calendarType: 'solar',
    timeRule: 'standard',
    year: '',
    month: '',
    day: '',
    hour: '',
    minute: '',
    unknownBirthTime: true,
    gender: '',
    birthLocationCode: '',
    birthLocationLabel: '',
    birthLatitude: '',
    birthLongitude: '',
  };
}

function createLocationState(): LocationState {
  return {
    status: 'idle',
    message: '',
    results: [],
  };
}

function createPersonalityState(): PersonalityState {
  return {
    mode: 'direct',
    typeCode: '',
    answers: [],
  };
}

function hasBirthFields<T extends ProfileApiBirthFields | null | undefined>(
  profile: T
): profile is NonNullable<T> & { birthYear: number; birthMonth: number; birthDay: number } {
  return Boolean(profile?.birthYear && profile.birthMonth && profile.birthDay);
}

function profileToDraft(profile: ProfileApiBirthFields & { birthYear: number; birthMonth: number; birthDay: number }) {
  return {
    calendarType: profile.calendarType ?? 'solar',
    timeRule: profile.timeRule ?? 'standard',
    year: String(profile.birthYear),
    month: String(profile.birthMonth),
    day: String(profile.birthDay),
    hour: profile.birthHour === null ? '' : String(profile.birthHour),
    minute: profile.birthHour === null || profile.birthMinute === null ? '' : String(profile.birthMinute),
    unknownBirthTime: profile.birthHour === null,
    gender: profile.gender ?? '',
    birthLocationCode: profile.birthLocationCode ?? '',
    birthLocationLabel: profile.birthLocationLabel ?? '',
    birthLatitude: profile.birthLatitude === null ? '' : String(profile.birthLatitude),
    birthLongitude: profile.birthLongitude === null ? '' : String(profile.birthLongitude),
  } satisfies UnifiedBirthEntryDraft;
}

function formatSavedProfileDetail(profile: ProfileApiBirthFields) {
  const calendarLabel = profile.calendarType === 'lunar' ? '음력' : '양력';
  const dateLabel = `${profile.birthYear}.${profile.birthMonth}.${profile.birthDay}`;
  const hourLabel =
    profile.birthHour === null
      ? '시간 미입력'
      : `${profile.birthHour}시${
          profile.birthMinute === null ? '' : ` ${String(profile.birthMinute).padStart(2, '0')}분`
        }`;
  const genderLabel = profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '성별 미선택';
  const locationLabel = profile.birthLocationLabel ? ` · ${profile.birthLocationLabel}` : '';

  return `${calendarLabel} ${dateLabel} · ${hourLabel} · ${genderLabel}${locationLabel}`;
}

function buildSavedProfileOptions(data: ProfileApiResponse): SavedBirthProfile[] {
  const options: SavedBirthProfile[] = [];

  if (hasBirthFields(data.profile)) {
    options.push({
      id: 'self',
      source: 'self',
      label: data.profile.displayName ? `내 정보 · ${data.profile.displayName}` : '내 정보',
      nickname: data.profile.displayName || '나',
      detail: formatSavedProfileDetail(data.profile),
      draft: profileToDraft(data.profile),
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
      draft: profileToDraft(profile),
    });
  });

  return options;
}

function applyUnifiedBirthPatch(
  current: UnifiedBirthEntryDraft,
  patch: Partial<UnifiedBirthEntryDraft>
): UnifiedBirthEntryDraft {
  const next: UnifiedBirthEntryDraft = {
    ...current,
    ...patch,
  };

  if (patch.unknownBirthTime === true || next.hour === '') {
    next.hour = '';
    next.minute = '';
    next.unknownBirthTime = true;
  }

  if (patch.hour && patch.hour !== '') {
    next.unknownBirthTime = false;
  }

  return next;
}

function formatBirthSummary(draft: UnifiedBirthEntryDraft) {
  const calendarLabel = draft.calendarType === 'lunar' ? '음력 입력' : '양력 입력';
  const dateLabel =
    draft.year && draft.month && draft.day
      ? `${draft.year}.${draft.month}.${draft.day}`
      : '생년월일 입력 전';
  const timeLabel = draft.unknownBirthTime || !draft.hour ? '시간 미입력' : `${draft.hour}시`;
  const genderLabel = draft.gender === 'male' ? '남성' : draft.gender === 'female' ? '여성' : '성별 미선택';
  const locationLabel = draft.birthLocationLabel ? ` · ${draft.birthLocationLabel}` : '';

  return `${calendarLabel} ${dateLabel} · ${timeLabel} · ${genderLabel}${locationLabel}`;
}

function getPersonalityResult(state: PersonalityState) {
  if (state.mode === 'direct') {
    if (!state.typeCode) return null;

    return {
      typeCode: state.typeCode,
      source: 'self_reported' as const,
      confidence: 0.65,
      axisScores: undefined,
      answers: undefined,
    };
  }

  const result = estimatePersonalityType(state.answers);
  if (result.answeredCount < PERSONALITY_SELF_CHECK_QUESTIONS.length) return null;

  return {
    typeCode: result.typeCode,
    source: 'moonlight_check' as const,
    confidence: result.confidence,
    axisScores: result.axisScores,
    answers: state.answers,
  };
}

function updateAnswers(
  answers: PersonalityCheckAnswer[],
  questionId: string,
  value: string
): PersonalityCheckAnswer[] {
  const next = answers.filter((answer) => answer.questionId !== questionId);
  return [...next, { questionId, value }];
}

function getAnswerValue(answers: PersonalityCheckAnswer[], questionId: string) {
  return answers.find((answer) => answer.questionId === questionId)?.value ?? '';
}

function SavedProfilePicker({
  profiles,
  status,
  selectedProfileId,
  onApply,
}: {
  profiles: SavedBirthProfile[];
  status: ProfileLoadStatus;
  selectedProfileId: string | null;
  onApply: (profile: SavedBirthProfile) => void;
}) {
  if (status === 'loading') {
    return (
      <div className="rounded-[1.2rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.65)] px-4 py-3 text-sm text-[var(--app-copy-muted)]">
        저장된 내 정보와 가족 정보를 확인하고 있습니다.
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <div className="rounded-[1.2rem] border border-[var(--app-line)] bg-white/75 px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
        로그인하지 않아 저장된 프로필은 불러오지 않았습니다. 아래에서 새로 입력해도 괜찮습니다.
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-[1.2rem] border border-[var(--app-line)] bg-white/75 px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
        불러올 수 있는 기존 프로필이 없으면 새로 입력으로 바로 진행할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {profiles.map((profile) => (
        <ChoiceRow
          key={profile.id}
          onClick={() => onApply(profile)}
          selected={selectedProfileId === profile.id}
          leading={profile.source === 'self' ? '나' : '家'}
          title={profile.label}
          description={profile.detail}
          trailing={profile.source === 'self' ? '내 정보' : '프로필'}
        />
      ))}
    </div>
  );
}

function PersonalityInputPanel({
  state,
  onChange,
}: {
  state: PersonalityState;
  onChange: (patch: Partial<PersonalityState>) => void;
}) {
  const checkResult = useMemo(() => estimatePersonalityType(state.answers), [state.answers]);
  const selectedType =
    state.mode === 'direct' && state.typeCode ? getPersonalityTypeProfile(state.typeCode) : null;
  const estimatedType =
    state.mode === 'check' && checkResult.answeredCount > 0
      ? getPersonalityTypeProfile(checkResult.typeCode)
      : null;

  return (
    <div className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
      <div className="grid gap-2">
        {[
          { value: 'direct' as const, label: '16유형 직접 선택', desc: '이미 알고 있는 성향 코드를 고릅니다.' },
          { value: 'check' as const, label: '잘 몰라요. 성향 체크하기', desc: '8문항으로 가볍게 성향을 추정합니다.' },
        ].map((option) => (
          <ChoiceRow
            key={option.value}
            onClick={() => onChange({ mode: option.value })}
            selected={state.mode === option.value}
            title={option.label}
            description={option.desc}
            trailing={state.mode === option.value ? '선택됨' : undefined}
          />
        ))}
      </div>

      {state.mode === 'direct' ? (
        <div className="mt-5">
          <AxisChipGrid
            items={PERSONALITY_TYPE_ITEMS}
            selectedId={state.typeCode}
            onSelect={(item) => onChange({ typeCode: item.id as PersonalityTypeCode })}
          />
          {selectedType ? (
            <p className="mt-3 rounded-[1rem] border border-[var(--app-jade)]/18 bg-[var(--app-jade)]/8 px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
              {selectedType.title} · {selectedType.communicationStyle}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {PERSONALITY_SELF_CHECK_QUESTIONS.map((question, index) => (
            <div key={question.id} className="rounded-[1.1rem] border border-[var(--gyeol-line)] bg-white px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-pink-soft)] text-xs font-bold text-[var(--app-pink-strong)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-6 text-[var(--app-ink)]">{question.title}</p>
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option) => (
                      <ChoiceRow
                        key={option.value}
                        onClick={() =>
                          onChange({ answers: updateAnswers(state.answers, question.id, option.value) })
                        }
                        selected={getAnswerValue(state.answers, question.id) === option.value}
                        title={option.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <p className="rounded-[1rem] border border-[var(--app-jade)]/18 bg-[var(--app-jade)]/8 px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
            현재 {checkResult.answeredCount}/{PERSONALITY_SELF_CHECK_QUESTIONS.length}개 응답
            {estimatedType
              ? ` · 예상 성향 ${checkResult.typeCode} (${estimatedType.title})`
              : ' · 문항을 선택하면 성향을 추정합니다.'}
          </p>
        </div>
      )}
    </div>
  );
}

export function SajuPersonalityInputClient() {
  const router = useRouter();
  const viewTrackedRef = useRef(false);
  const birthCompletedTrackedRef = useRef(false);
  const directTypeTrackedRef = useRef(false);
  const checkCompletedTrackedRef = useRef(false);
  const [displayName, setDisplayName] = useState('나');
  const [birthDraft, setBirthDraft] = useState<UnifiedBirthEntryDraft>(() => createInitialDraft());
  const [selectedProfile, setSelectedProfile] = useState<SavedBirthProfile | null>(null);
  const [profileLoadStatus, setProfileLoadStatus] = useState<ProfileLoadStatus>('idle');
  const [profileLoadMessage, setProfileLoadMessage] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<SavedBirthProfile[]>([]);
  const [locationState, setLocationState] = useState<LocationState>(() => createLocationState());
  const [personality, setPersonality] = useState<PersonalityState>(() => createPersonalityState());
  const [lifeArea, setLifeArea] = useState<SajuPersonalityLifeArea>('basic');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeStep, setActiveStep] = useState<SajuPersonalityInputStep>('profile');

  const activeStepIndex = SAJU_PERSONALITY_STEPS.findIndex((step) => step.key === activeStep);
  const currentStep = SAJU_PERSONALITY_STEPS[activeStepIndex] ?? SAJU_PERSONALITY_STEPS[0];
  const birthSummary = useMemo(() => formatBirthSummary(birthDraft), [birthDraft]);
  const selectedLifeArea =
    LIFE_AREA_OPTIONS.find((option) => option.value === lifeArea) ?? LIFE_AREA_OPTIONS[0];

  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;

    trackMoonlightEvent('saju_personality_viewed', {
      source: 'saju_personality_input',
    });
  }, []);

  useEffect(() => {
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
        setSavedProfiles(options);
        setProfileLoadStatus(options.length > 0 ? 'ready' : 'empty');
      } catch {
        if (cancelled) return;
        setProfileLoadStatus('error');
        setProfileLoadMessage('저장된 프로필을 확인하는 중 네트워크 오류가 발생했습니다.');
      }
    }

    void loadSavedProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateDraft(patch: Partial<UnifiedBirthEntryDraft>) {
    setBirthDraft((current) => applyUnifiedBirthPatch(current, patch));
    setSelectedProfile(null);
  }

  function applySavedProfile(profile: SavedBirthProfile) {
    setSelectedProfile(profile);
    setBirthDraft(profile.draft);
    setDisplayName(profile.nickname || '나');
    setLocationState(createLocationState());
    setProfileLoadMessage(`${profile.label} 정보를 불러왔습니다. 필요하면 아래에서 수정할 수 있습니다.`);
    trackMoonlightEvent('saju_personality_profile_selected', {
      source: profile.source,
    });
  }

  function updatePersonality(patch: Partial<PersonalityState>) {
    setPersonality((current) => {
      const next = { ...current, ...patch };

      if (next.mode === 'direct' && next.typeCode && !directTypeTrackedRef.current) {
        directTypeTrackedRef.current = true;
        trackMoonlightEvent('saju_personality_type_selected', {
          source: 'direct',
          confidence: 0.65,
        });
      }

      if (
        next.mode === 'check' &&
        next.answers.length === PERSONALITY_SELF_CHECK_QUESTIONS.length &&
        !checkCompletedTrackedRef.current
      ) {
        const result = estimatePersonalityType(next.answers);
        checkCompletedTrackedRef.current = true;
        trackMoonlightEvent('saju_personality_check_completed', {
          source: 'check',
          confidence: result.confidence,
        });
      }

      return next;
    });
  }

  function selectLifeArea(nextLifeArea: SajuPersonalityLifeArea) {
    setLifeArea(nextLifeArea);
    trackMoonlightEvent('saju_personality_life_area_selected', {
      source: 'saju_personality_input',
      lifeArea: nextLifeArea,
    });
  }

  function updateBirthLocation(code: string) {
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);

    updateDraft({
      birthLocationCode: code,
      birthLocationLabel: code === 'custom' ? birthDraft.birthLocationLabel : preset?.label ?? '',
      birthLatitude: code === 'custom' ? birthDraft.birthLatitude : preset ? String(preset.latitude) : '',
      birthLongitude: code === 'custom' ? birthDraft.birthLongitude : preset ? String(preset.longitude) : '',
    });
    setLocationState(createLocationState());
  }

  async function searchBirthLocationCoordinates() {
    const query = birthDraft.birthLocationLabel.trim();

    if (query.length < 2) {
      setLocationState({
        status: 'error',
        message: '지역명을 두 글자 이상 입력해 주세요.',
        results: [],
      });
      return;
    }

    setLocationState({
      status: 'loading',
      message: '',
      results: [],
    });

    try {
      const response = await fetch(`/api/geo/birth-location?q=${encodeURIComponent(query)}`, {
        cache: 'force-cache',
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: BirthLocationSearchResultLike[] }
        | null;

      if (!response.ok || !data?.ok) {
        setLocationState({
          status: 'error',
          message: data?.error ?? '지역 좌표를 찾지 못했습니다.',
          results: [],
        });
        return;
      }

      const items = data.items ?? [];
      setLocationState({
        status: items.length > 0 ? 'ready' : 'empty',
        message:
          items.length > 0
            ? '가장 가까운 지역을 골라 위도와 경도를 적용해 주세요.'
            : '검색 결과가 없습니다. 시/군/구 이름이나 영문 지명을 함께 입력해 보세요.',
        results: items,
      });
    } catch {
      setLocationState({
        status: 'error',
        message: '지역 좌표를 찾는 중 네트워크 오류가 발생했습니다.',
        results: [],
      });
    }
  }

  function applyBirthLocationSearchResult(result: BirthLocationSearchResultLike) {
    updateDraft({
      birthLocationCode: 'custom',
      birthLocationLabel: result.label,
      birthLatitude: String(result.latitude),
      birthLongitude: String(result.longitude),
    });
    setLocationState({
      status: 'ready',
      message: `${result.label} 좌표를 적용했습니다.`,
      results: [],
    });
  }

  function validateBirthStep() {
    const parsed = resolveUnifiedBirthInput(birthDraft, { requireGender: true });
    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return false;
    }

    if (!birthCompletedTrackedRef.current) {
      birthCompletedTrackedRef.current = true;
      trackMoonlightEvent('saju_personality_birth_info_completed', {
        source: selectedProfile ? selectedProfile.source : 'manual',
      });
    }

    setErrorMessage('');
    return true;
  }

  function validatePersonalityStep() {
    if (!getPersonalityResult(personality)) {
      setErrorMessage('성향 유형을 직접 선택하거나 8문항 성향 체크를 모두 선택해 주세요.');
      return false;
    }

    setErrorMessage('');
    return true;
  }

  function goToPreviousStep() {
    const previousStep = SAJU_PERSONALITY_STEPS[Math.max(0, activeStepIndex - 1)];
    setErrorMessage('');
    setActiveStep(previousStep.key);
  }

  function goToNextStep() {
    if (activeStep === 'profile' && !validateBirthStep()) return;
    if (activeStep === 'personality' && !validatePersonalityStep()) return;

    const nextStep = SAJU_PERSONALITY_STEPS[Math.min(SAJU_PERSONALITY_STEPS.length - 1, activeStepIndex + 1)];
    setErrorMessage('');
    setActiveStep(nextStep.key);
  }

  function submitSajuPersonalityInput() {
    const parsed = resolveUnifiedBirthInput(birthDraft, { requireGender: true });
    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      setIsSubmitted(false);
      return;
    }

    if (!birthCompletedTrackedRef.current) {
      birthCompletedTrackedRef.current = true;
      trackMoonlightEvent('saju_personality_birth_info_completed', {
        source: selectedProfile ? selectedProfile.source : 'manual',
      });
    }

    const personalityResult = getPersonalityResult(personality);
    if (!personalityResult) {
      setErrorMessage('성향 유형을 직접 선택하거나 8문항 성향 체크를 모두 선택해 주세요.');
      setIsSubmitted(false);
      return;
    }

    saveSajuPersonalityInputPayload({
      version: 1,
      entryMode: selectedProfile ? 'saved_profile' : 'manual',
      profileId: selectedProfile?.id ?? null,
      profileSource: selectedProfile?.source ?? 'manual',
      displayName: displayName.trim() || '나',
      birthInput: parsed.input,
      birthSummary,
      personality: personalityResult,
      lifeArea,
      lifeAreaLabel: selectedLifeArea.label,
      createdAt: new Date().toISOString(),
    });

    setErrorMessage('');
    setIsSubmitted(true);
    router.push('/saju/personality/result');
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <MoonlightAppPage className="gangi-subpage gangi-responsive-page space-y-5" size="md">
        <PageIntro
          eyebrow="달빛 성향사주"
          title="사주로 보는 타고난 결, 성향으로 보는 선택 습관"
          description="年 月 日 時의 네 기둥과 I/E, S/N, T/F, J/P의 네 축을 함께 보되, 공식 검사처럼 단정하지 않는 참고용 자기이해 흐름입니다."
        />
        <FusionStrip />
        <StepFlowShell
          currentStep={activeStepIndex + 1}
          totalSteps={SAJU_PERSONALITY_STEPS.length}
          title={currentStep.title}
          description={currentStep.description}
          className="gangi-responsive-form-panel"
        >
          {isSubmitted ? (
            <div className="rounded-[1.2rem] border border-[var(--app-jade)]/24 bg-[var(--app-jade)]/10 px-4 py-3 text-sm leading-6 text-[var(--app-ink)]">
              입력값을 임시 저장했습니다. 무료 결과 화면으로 이동합니다.
            </div>
          ) : null}

          {activeStep === 'profile' ? (
            <div className="space-y-4">
              <SavedProfilePicker
                profiles={savedProfiles}
                status={profileLoadStatus}
                selectedProfileId={selectedProfile?.id ?? null}
                onApply={applySavedProfile}
              />
              {profileLoadMessage ? (
                <p
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm leading-6',
                    profileLoadStatus === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-[var(--app-jade)]/20 bg-[var(--app-jade)]/8 text-[var(--app-copy)]'
                  )}
                >
                  {profileLoadMessage}
                </p>
              ) : null}
              <div className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="app-caption text-[var(--app-pink-strong)]">내 정보</div>
                    <h2 className="mt-2 text-xl font-bold text-[var(--app-ink)]">생년월일시 확인</h2>
                  </div>
                  <div className="max-w-sm text-left text-xs leading-6 text-[var(--app-copy-soft)] sm:text-right">
                    {birthSummary}
                  </div>
                </div>
                <div className="mb-5">
                  <Label htmlFor="saju-personality-display-name" className="mb-2 block text-sm text-[var(--app-copy)]">
                    이름 또는 별명
                  </Label>
                  <Input
                    id="saju-personality-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="나"
                    className="gangi-form-control h-11 px-3 text-sm"
                  />
                </div>
                <UnifiedBirthInfoFields
                  idPrefix="saju-personality"
                  draft={birthDraft}
                  onChange={updateDraft}
                  locationLoading={locationState.status === 'loading'}
                  locationMessage={locationState.message}
                  locationResults={locationState.results}
                  onLocationSearch={searchBirthLocationCoordinates}
                  onPresetSelect={updateBirthLocation}
                  onLocationResultSelect={applyBirthLocationSearchResult}
                />
              </div>
            </div>
          ) : null}

          {activeStep === 'personality' ? (
            <PersonalityInputPanel state={personality} onChange={updatePersonality} />
          ) : null}

          {activeStep === 'lifeArea' ? (
            <div className="grid gap-2">
              {LIFE_AREA_OPTIONS.map((item) => (
                <ChoiceRow
                  key={item.value}
                  onClick={() => selectLifeArea(item.value)}
                  selected={lifeArea === item.value}
                  title={item.label}
                  description={item.description}
                  trailing={lifeArea === item.value ? '선택됨' : undefined}
                />
              ))}
            </div>
          ) : null}

          {activeStep === 'result' ? (
            <div className="space-y-3 rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 text-sm leading-6 text-[var(--gyeol-muted)]">
              <p>
                <strong className="text-[var(--gyeol-text)]">내 정보</strong>
                <br />
                {birthSummary}
              </p>
              <p>
                <strong className="text-[var(--gyeol-text)]">성향 입력</strong>
                <br />
                {personality.mode === 'direct'
                  ? personality.typeCode || '아직 선택 전'
                  : `성향 체크 ${personality.answers.length}/${PERSONALITY_SELF_CHECK_QUESTIONS.length}`}
              </p>
              <p>
                <strong className="text-[var(--gyeol-text)]">관심영역</strong>
                <br />
                {selectedLifeArea.label}
              </p>
              <SafetyNotice />
            </div>
          ) : null}
        </StepFlowShell>

        {errorMessage ? (
          <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <StickyActionBar note="입력값은 무료 결과 생성을 위해 이 브라우저에만 임시 보관됩니다.">
          <Button
            type="button"
            variant="secondary"
            onClick={activeStepIndex === 0 ? () => router.push('/saju/new') : goToPreviousStep}
          >
            {activeStepIndex === 0 ? '일반 사주로' : '이전'}
          </Button>
          <Button
            type="button"
            onClick={activeStep === 'result' ? submitSajuPersonalityInput : goToNextStep}
          >
            {activeStep === 'result' ? '무료 결과 보기' : '다음'}
          </Button>
        </StickyActionBar>
      </MoonlightAppPage>
    </AppShell>
  );
}
