'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  estimatePersonalityType,
  getPersonalityTypeProfile,
  PERSONALITY_SELF_CHECK_QUESTIONS,
  PERSONALITY_TYPE_CODES,
  type PersonalityCheckAnswer,
  type PersonalityTypeCode,
} from '@/domain/personality';
import type { CompatibilityRelationshipType } from '@/domain/compatibility-personality';
import { UnifiedBirthInfoFields, type BirthLocationSearchResultLike } from '@/components/saju/shared/unified-birth-info-fields';
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
import {
  PERSONALITY_COMPATIBILITY_INPUT_SESSION_KEY,
  type PersonalityCompatibilityInputPayload,
  type PersonalityCompatibilityQuestionKey,
} from '@/features/compatibility/personality-compatibility-input-storage';
import { trackMoonlightEvent } from '@/lib/analytics';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { AppShell } from '@/shared/layout/app-shell';

type PersonKey = 'self' | 'partner';
type PersonalityInputMode = 'direct' | 'check';
type ProfileLoadStatus = 'idle' | 'loading' | 'ready' | 'anonymous' | 'empty' | 'error';
type LocationSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type PersonalityCompatibilityInputStep =
  | 'relationship'
  | 'self'
  | 'partner'
  | 'personality'
  | 'question'
  | 'result';

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
  relationship: string;
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

const RELATIONSHIP_OPTIONS: Array<{
  value: CompatibilityRelationshipType;
  label: string;
  description: string;
}> = [
  {
    value: 'dating',
    label: '연인/썸',
    description: '끌림과 표현 속도를 중심으로 봅니다.',
  },
  {
    value: 'marriage',
    label: '배우자/결혼',
    description: '생활 안정과 장기 조율을 중심으로 봅니다.',
  },
  {
    value: 'friendship',
    label: '친구/형제',
    description: '편안함과 거리감을 중심으로 봅니다.',
  },
  {
    value: 'family',
    label: '부모/자녀',
    description: '역할 기대와 말의 온도를 중심으로 봅니다.',
  },
  {
    value: 'business',
    label: '동업/파트너',
    description: '결정 기준과 책임 분담을 중심으로 봅니다.',
  },
];

const QUESTION_OPTIONS: Array<{
  value: PersonalityCompatibilityQuestionKey;
  label: string;
  description: string;
}> = [
  {
    value: 'fit',
    label: '이 사람과 잘 맞는지',
    description: '전체 궁합의 결을 먼저 보고 싶을 때',
  },
  {
    value: 'conflict',
    label: '왜 자꾸 싸우는지',
    description: '반복되는 말투와 오해를 정리하고 싶을 때',
  },
  {
    value: 'heart',
    label: '상대의 마음이 어떤지',
    description: '표현 방식과 마음 확인의 차이를 보고 싶을 때',
  },
  {
    value: 'recovery',
    label: '다시 가까워질 수 있는지',
    description: '서운함 뒤 회복 방식을 찾고 싶을 때',
  },
  {
    value: 'timing',
    label: '고백/연락 타이밍이 좋은지',
    description: '말을 꺼내는 속도와 온도를 보고 싶을 때',
  },
  {
    value: 'long_term',
    label: '결혼/장기 관계 가능성이 있는지',
    description: '오래 맞춰갈 현실 기준을 보고 싶을 때',
  },
];

const PERSONALITY_COMPATIBILITY_STEPS: Array<{
  key: PersonalityCompatibilityInputStep;
  title: string;
  description: string;
}> = [
  {
    key: 'relationship',
    title: '관계 유형을 골라 주세요',
    description: '관계에 따라 사주와 성향을 보는 비중이 달라집니다.',
  },
  {
    key: 'self',
    title: '내 정보를 확인해 주세요',
    description: '저장된 프로필을 불러오거나 생년월일시를 새로 입력합니다.',
  },
  {
    key: 'partner',
    title: '상대 정보를 확인해 주세요',
    description: '상대의 생년월일시와 기본 정보를 같은 방식으로 입력합니다.',
  },
  {
    key: 'personality',
    title: '두 사람의 16유형 성향을 알려 주세요',
    description: '직접 선택하거나 성향 체크로 가볍게 추정합니다.',
  },
  {
    key: 'question',
    title: '현재 질문을 골라 주세요',
    description: '리포트가 어떤 관계 고민에 초점을 맞출지 정합니다.',
  },
  {
    key: 'result',
    title: '무료 결과를 만들 준비가 됐어요',
    description: '입력한 내용을 확인하고 성향궁합 무료 결과로 이동합니다.',
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

function hasReusableBirthDraft(draft: UnifiedBirthEntryDraft) {
  return Boolean(draft.year.trim() && draft.month.trim() && draft.day.trim());
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
          profile.birthMinute === null ? '' : ` ${String(profile.birthMinute).padStart(2, '0')}분`
        }`;
  const genderLabel = profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '성별 미선택';
  const locationLabel = profile.birthLocationLabel
    ? ` · ${profile.birthLocationLabel}${profile.solarTimeMode === 'longitude' ? ' 경도 보정' : ''}`
    : '';

  return `${calendarLabel} ${dateLabel} · ${hourLabel} · ${genderLabel}${locationLabel}`;
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

function buildSavedProfileOptions(data: ProfileApiResponse): SavedBirthProfile[] {
  const options: SavedBirthProfile[] = [];

  if (hasBirthFields(data.profile)) {
    options.push({
      id: 'self',
      source: 'self',
      label: data.profile.displayName ? `내 정보 · ${data.profile.displayName}` : '내 정보 불러오기',
      relationship: '내 정보',
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
      relationship: profile.relationship,
      nickname: profile.label,
      detail: formatSavedProfileDetail(profile),
      draft: profileToDraft(profile),
    });
  });

  return options;
}

function inferRelationshipMatch(relationship: string, selected: CompatibilityRelationshipType) {
  const value = relationship.trim();

  if (selected === 'dating') return /연인|남자친구|여자친구|썸|애인|상대/.test(value);
  if (selected === 'marriage') return /배우자|남편|아내|부부|결혼|약혼/.test(value);
  if (selected === 'family') return /부모|엄마|아빠|어머니|아버지|자녀|아들|딸|가족/.test(value);
  if (selected === 'business') return /동료|파트너|동업|상사|부하|팀원|거래처/.test(value);
  return /친구|형제|자매|지인/.test(value);
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
  const parsed = resolveUnifiedBirthInput(draft, { requireGender: true });
  const calendarLabel = draft.calendarType === 'lunar' ? '음력 입력' : '양력 입력';
  const dateLabel =
    draft.year && draft.month && draft.day
      ? `${draft.year}.${draft.month}.${draft.day}`
      : '생년월일 입력 전';
  const genderLabel = draft.gender === 'male' ? '남성' : draft.gender === 'female' ? '여성' : '성별 미선택';

  if (!parsed.ok) {
    return `${calendarLabel} ${dateLabel} · ${genderLabel}`;
  }

  const input = parsed.input;
  const timeLabel =
    input.hour === undefined
      ? '시간 미입력'
      : `${input.hour}시${input.minute === undefined ? '' : ` ${String(input.minute).padStart(2, '0')}분`}`;
  const locationLabel = input.birthLocation
    ? ` · ${input.birthLocation.label}${input.solarTimeMode === 'longitude' ? ' 경도 보정' : ''}`
    : '';

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

function SavedProfileQuickFill({
  target,
  profiles,
  status,
  onApply,
}: {
  target: PersonKey;
  profiles: SavedBirthProfile[];
  status: ProfileLoadStatus;
  onApply: (target: PersonKey, profile: SavedBirthProfile) => void;
}) {
  if (status === 'loading') {
    return (
      <div className="rounded-[1.2rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--app-copy-muted)]">
        저장한 내 정보와 가족 정보를 확인하고 있습니다.
      </div>
    );
  }

  if (profiles.length === 0) return null;

  return (
    <div className="rounded-[1.35rem] border border-[var(--app-pink)]/18 bg-[var(--app-pink)]/8 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="app-caption text-[var(--app-pink-strong)]">저장 정보</div>
          <h3 className="mt-1 text-lg font-semibold text-[var(--app-ink)]">
            {target === 'self' ? '내 정보에 저장 프로필을 불러올 수 있습니다' : '상대 정보에 저장 프로필을 불러올 수 있습니다'}
          </h3>
        </div>
        <p className="text-xs leading-5 text-[var(--app-copy-soft)]">
          성향은 별도로 직접 선택하거나 간단 체크로 입력해 주세요.
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {profiles.map((profile) => (
          <ChoiceRow
            key={`${target}-${profile.id}`}
            onClick={() => onApply(target, profile)}
            leading={profile.source === 'self' ? '나' : '家'}
            title={profile.label}
            description={profile.detail}
            trailing="불러오기"
          />
        ))}
      </div>
    </div>
  );
}

function PersonalityInputPanel({
  title,
  state,
  onChange,
}: {
  title: string;
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
    <section className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
      <div className="mb-5">
        <div className="app-caption text-[var(--app-pink-strong)]">{title}</div>
        <h3 className="mt-2 text-xl font-bold text-[var(--app-ink)]">16유형 성향 입력</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--app-copy-soft)]">
          성향 체크는 참고용 자기이해 콘텐츠이며, 공식 검사나 진단처럼 사용하지 않습니다.
        </p>
      </div>

      <div className="grid gap-2">
        {[
          { value: 'direct' as const, label: '16유형 직접 선택', desc: '이미 알고 있는 성향 코드를 고릅니다.' },
          { value: 'check' as const, label: '잘 몰라요. 간단 체크하기', desc: '짧은 선택 문항으로 성향을 추정합니다.' },
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
              {selectedType.title} · {selectedType.relationshipHint}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {PERSONALITY_SELF_CHECK_QUESTIONS.map((question, index) => (
            <div
              key={question.id}
              className="rounded-[1.1rem] border border-[var(--app-line)] bg-white px-4 py-4"
            >
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
    </section>
  );
}

export function PersonalityCompatibilityInputClient() {
  const router = useRouter();
  const trackedProfileCompletionRef = useRef<Set<PersonKey>>(new Set());
  const trackedCheckCompletionRef = useRef<Set<PersonKey>>(new Set());
  const profileLoadStartedRef = useRef(false);
  const [relationshipType, setRelationshipType] = useState<CompatibilityRelationshipType>('dating');
  const [selfName, setSelfName] = useState('나');
  const [partnerName, setPartnerName] = useState('상대');
  const [selfDraft, setSelfDraft] = useState<UnifiedBirthEntryDraft>(() => createInitialDraft());
  const [partnerDraft, setPartnerDraft] = useState<UnifiedBirthEntryDraft>(() => createInitialDraft());
  const [profileLoadStatus, setProfileLoadStatus] = useState<ProfileLoadStatus>('idle');
  const [profileLoadMessage, setProfileLoadMessage] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<SavedBirthProfile[]>([]);
  const [selfPersonality, setSelfPersonality] = useState<PersonalityState>(() => createPersonalityState());
  const [partnerPersonality, setPartnerPersonality] = useState<PersonalityState>(() => createPersonalityState());
  const [questionKey, setQuestionKey] = useState<PersonalityCompatibilityQuestionKey>('fit');
  const [locationStates, setLocationStates] = useState<Record<PersonKey, LocationState>>({
    self: createLocationState(),
    partner: createLocationState(),
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeStep, setActiveStep] = useState<PersonalityCompatibilityInputStep>('relationship');

  const activeStepIndex = PERSONALITY_COMPATIBILITY_STEPS.findIndex((step) => step.key === activeStep);
  const currentStep = PERSONALITY_COMPATIBILITY_STEPS[activeStepIndex] ?? PERSONALITY_COMPATIBILITY_STEPS[0];
  const selfSummary = useMemo(() => formatBirthSummary(selfDraft), [selfDraft]);
  const partnerSummary = useMemo(() => formatBirthSummary(partnerDraft), [partnerDraft]);
  const selectedQuestion = QUESTION_OPTIONS.find((item) => item.value === questionKey) ?? QUESTION_OPTIONS[0];
  const sortedSavedProfiles = useMemo(
    () =>
      [...savedProfiles].sort((left, right) => {
        const leftMatch = inferRelationshipMatch(left.relationship, relationshipType) ? 0 : 1;
        const rightMatch = inferRelationshipMatch(right.relationship, relationshipType) ? 0 : 1;

        if (left.source !== right.source) return left.source === 'self' ? -1 : 1;
        if (leftMatch !== rightMatch) return leftMatch - rightMatch;
        return left.label.localeCompare(right.label);
      }),
    [relationshipType, savedProfiles]
  );

  useEffect(() => {
    trackMoonlightEvent('personality_compatibility_viewed', {
      source: 'input_page',
    });
  }, []);

  useEffect(() => {
    if (activeStep === 'relationship' || profileLoadStartedRef.current) return;

    profileLoadStartedRef.current = true;
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

        const selfProfile = options.find((profile) => profile.source === 'self');
        if (selfProfile && !hasReusableBirthDraft(selfDraft)) {
          setSelfDraft((current) => applyUnifiedBirthPatch(current, selfProfile.draft));
          setSelfName(selfProfile.nickname || '나');
          setProfileLoadMessage('로그인된 내 정보를 내 정보 칸에 자동으로 불러왔습니다.');
        }
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
  }, [activeStep]);

  function selectRelationshipType(nextRelationshipType: CompatibilityRelationshipType) {
    setRelationshipType(nextRelationshipType);
    trackMoonlightEvent('relationship_type_selected', {
      relationshipType: nextRelationshipType,
      source: 'personality_compatibility_input',
    });
  }

  function updatePersonality(target: PersonKey, patch: Partial<PersonalityState>) {
    const updateState = target === 'self' ? setSelfPersonality : setPartnerPersonality;
    const current = target === 'self' ? selfPersonality : partnerPersonality;
    const next = { ...current, ...patch };

    if (patch.typeCode && next.mode === 'direct') {
      trackMoonlightEvent('personality_type_selected', {
        profileSlot: target === 'self' ? 'a' : 'b',
        inputMode: 'direct',
        source: 'personality_compatibility_input',
      });
    }

    if (
      next.mode === 'check' &&
      next.answers.length >= PERSONALITY_SELF_CHECK_QUESTIONS.length &&
      !trackedCheckCompletionRef.current.has(target)
    ) {
      trackedCheckCompletionRef.current.add(target);
      trackMoonlightEvent('personality_check_completed', {
        profileSlot: target === 'self' ? 'a' : 'b',
        inputMode: 'check',
        source: 'personality_compatibility_input',
      });
    }

    updateState(next);
  }

  function trackProfileCompleted(target: PersonKey) {
    if (trackedProfileCompletionRef.current.has(target)) return;

    trackedProfileCompletionRef.current.add(target);
    trackMoonlightEvent(target === 'self' ? 'profile_a_completed' : 'profile_b_completed', {
      profileSlot: target === 'self' ? 'a' : 'b',
      relationshipType,
      source: 'personality_compatibility_input',
    });
  }

  function updateDraft(target: PersonKey, patch: Partial<UnifiedBirthEntryDraft>) {
    if (target === 'self') {
      setSelfDraft((current) => applyUnifiedBirthPatch(current, patch));
      return;
    }

    setPartnerDraft((current) => applyUnifiedBirthPatch(current, patch));
  }

  function updateLocationState(target: PersonKey, patch: Partial<LocationState>) {
    setLocationStates((current) => ({
      ...current,
      [target]: {
        ...current[target],
        ...patch,
      },
    }));
  }

  function updateBirthLocation(target: PersonKey, code: string) {
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
    const current = target === 'self' ? selfDraft : partnerDraft;

    updateDraft(target, {
      birthLocationCode: code,
      birthLocationLabel: code === 'custom' ? current.birthLocationLabel : preset?.label ?? '',
      birthLatitude: code === 'custom' ? current.birthLatitude : preset ? String(preset.latitude) : '',
      birthLongitude: code === 'custom' ? current.birthLongitude : preset ? String(preset.longitude) : '',
    });
    updateLocationState(target, createLocationState());
  }

  async function searchBirthLocationCoordinates(target: PersonKey) {
    const draft = target === 'self' ? selfDraft : partnerDraft;
    const query = draft.birthLocationLabel.trim();

    if (query.length < 2) {
      updateLocationState(target, {
        status: 'error',
        message: '지역명을 두 글자 이상 입력해 주세요.',
        results: [],
      });
      return;
    }

    updateLocationState(target, {
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
        updateLocationState(target, {
          status: 'error',
          message: data?.error ?? '지역 좌표를 찾지 못했습니다.',
          results: [],
        });
        return;
      }

      const items = data.items ?? [];
      updateLocationState(target, {
        status: items.length > 0 ? 'ready' : 'empty',
        message:
          items.length > 0
            ? '가장 가까운 지역을 골라 위도와 경도를 적용해 주세요.'
            : '검색 결과가 없습니다. 시/군/구 이름이나 영문 지명을 함께 입력해 보세요.',
        results: items,
      });
    } catch {
      updateLocationState(target, {
        status: 'error',
        message: '지역 좌표를 찾는 중 네트워크 오류가 발생했습니다.',
        results: [],
      });
    }
  }

  function applyBirthLocationSearchResult(target: PersonKey, result: BirthLocationSearchResultLike) {
    updateDraft(target, {
      birthLocationCode: 'custom',
      birthLocationLabel: result.label,
      birthLatitude: String(result.latitude),
      birthLongitude: String(result.longitude),
    });
    updateLocationState(target, {
      status: 'ready',
      message: `${result.label} 좌표를 적용했습니다.`,
      results: [],
    });
  }

  function applySavedProfile(target: PersonKey, profile: SavedBirthProfile) {
    updateDraft(target, profile.draft);

    if (target === 'self') {
      setSelfName(profile.nickname || '나');
      setProfileLoadMessage(`${profile.label} 정보를 내 정보 입력칸에 불러왔습니다.`);
      return;
    }

    setPartnerName(profile.nickname || '상대');
    setProfileLoadMessage(`${profile.label} 정보를 상대 정보 입력칸에 불러왔습니다.`);
  }

  function validateBirthStep(target: PersonKey) {
    const draft = target === 'self' ? selfDraft : partnerDraft;
    const parsed = resolveUnifiedBirthInput(draft, { requireGender: true });

    if (!parsed.ok) {
      setErrorMessage(`${target === 'self' ? '내 정보' : '상대 정보'}: ${parsed.error}`);
      return false;
    }

    trackProfileCompleted(target);
    setErrorMessage('');
    return true;
  }

  function validatePersonalityStep() {
    if (!getPersonalityResult(selfPersonality)) {
      setErrorMessage('내 성향을 직접 선택하거나 성향 체크 문항을 모두 선택해 주세요.');
      return false;
    }

    if (!getPersonalityResult(partnerPersonality)) {
      setErrorMessage('상대 성향을 직접 선택하거나 성향 체크 문항을 모두 선택해 주세요.');
      return false;
    }

    setErrorMessage('');
    return true;
  }

  function goToPreviousStep() {
    const previousStep = PERSONALITY_COMPATIBILITY_STEPS[Math.max(0, activeStepIndex - 1)];
    setErrorMessage('');
    setActiveStep(previousStep.key);
  }

  function goToNextStep() {
    if (activeStep === 'self' && !validateBirthStep('self')) return;
    if (activeStep === 'partner' && !validateBirthStep('partner')) return;
    if (activeStep === 'personality' && !validatePersonalityStep()) return;

    const nextStep =
      PERSONALITY_COMPATIBILITY_STEPS[
        Math.min(PERSONALITY_COMPATIBILITY_STEPS.length - 1, activeStepIndex + 1)
      ];
    setErrorMessage('');
    setActiveStep(nextStep.key);
  }

  function submitPersonalityCompatibility() {
    const selfParsed = resolveUnifiedBirthInput(selfDraft, { requireGender: true });
    if (!selfParsed.ok) {
      setErrorMessage(`내 정보: ${selfParsed.error}`);
      setIsSubmitted(false);
      return;
    }
    trackProfileCompleted('self');

    const partnerParsed = resolveUnifiedBirthInput(partnerDraft, { requireGender: true });
    if (!partnerParsed.ok) {
      setErrorMessage(`상대 정보: ${partnerParsed.error}`);
      setIsSubmitted(false);
      return;
    }
    trackProfileCompleted('partner');

    const selfPersonalityResult = getPersonalityResult(selfPersonality);
    if (!selfPersonalityResult) {
      setErrorMessage('내 성향을 직접 선택하거나 간단 체크 문항을 모두 선택해 주세요.');
      setIsSubmitted(false);
      return;
    }

    const partnerPersonalityResult = getPersonalityResult(partnerPersonality);
    if (!partnerPersonalityResult) {
      setErrorMessage('상대 성향을 직접 선택하거나 간단 체크 문항을 모두 선택해 주세요.');
      setIsSubmitted(false);
      return;
    }

    const payload: PersonalityCompatibilityInputPayload = {
      version: 1,
      relationshipType,
      questionKey,
      questionLabel: selectedQuestion.label,
      self: {
        name: selfName.trim() || '나',
        birthInput: selfParsed.input,
        birthSummary: selfSummary,
        personality: selfPersonalityResult,
      },
      partner: {
        name: partnerName.trim() || '상대',
        birthInput: partnerParsed.input,
        birthSummary: partnerSummary,
        personality: partnerPersonalityResult,
      },
      createdAt: new Date().toISOString(),
    };

    window.sessionStorage.setItem(
      PERSONALITY_COMPATIBILITY_INPUT_SESSION_KEY,
      JSON.stringify(payload)
    );
    console.info('personality compatibility input completed', {
      relationshipType,
      questionKey,
      selfPersonalitySource: selfPersonalityResult.source,
      partnerPersonalitySource: partnerPersonalityResult.source,
      hasSelfBirthInput: true,
      hasPartnerBirthInput: true,
    });
    setErrorMessage('');
    setIsSubmitted(true);
    router.push('/compatibility/personality/result');
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <MoonlightAppPage className="gangi-subpage space-y-5" size="md">
        <PageIntro
          eyebrow="달빛 성향궁합"
          title="사주와 성향으로 관계의 결을 봅니다"
          description="두 사람의 사주 네 기둥과 두 사람의 성향 네 축을 함께 보며, 왜 끌리고 왜 부딪히는지 조율 포인트를 정리합니다."
        />
        <FusionStrip prefixLabel="사주 궁합" suffixLabel="성향 궁합" />
        <StepFlowShell
          currentStep={activeStepIndex + 1}
          totalSteps={PERSONALITY_COMPATIBILITY_STEPS.length}
          title={currentStep.title}
          description={currentStep.description}
        >
          {isSubmitted ? (
            <div className="rounded-[1.2rem] border border-[var(--app-jade)]/24 bg-[var(--app-jade)]/10 px-4 py-3 text-sm leading-6 text-[var(--app-ink)]">
              입력값을 임시 저장했습니다. 무료 결과 화면으로 이동합니다.
            </div>
          ) : null}

          {activeStep === 'relationship' ? (
            <div className="grid gap-2">
              {RELATIONSHIP_OPTIONS.map((item) => (
                <ChoiceRow
                  key={item.value}
                  onClick={() => selectRelationshipType(item.value)}
                  selected={relationshipType === item.value}
                  title={item.label}
                  description={item.description}
                  trailing={relationshipType === item.value ? '선택됨' : undefined}
                />
              ))}
            </div>
          ) : null}

          {activeStep === 'self' ? (
            <div className="space-y-4">
              <SavedProfileQuickFill
                target="self"
                profiles={sortedSavedProfiles}
                status={profileLoadStatus}
                onApply={applySavedProfile}
              />
              {profileLoadMessage && profileLoadStatus !== 'error' ? (
                <div className="rounded-2xl border border-[var(--app-jade)]/20 bg-[var(--app-jade)]/8 px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
                  {profileLoadMessage}
                </div>
              ) : null}
              <section className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="app-caption text-[var(--app-pink-strong)]">나</div>
                    <h2 className="mt-2 text-xl font-bold text-[var(--app-ink)]">내 정보</h2>
                  </div>
                  <div className="max-w-sm text-left text-xs leading-6 text-[var(--app-copy-soft)] sm:text-right">
                    {selfSummary}
                  </div>
                </div>
                <div className="mb-5">
                  <Label htmlFor="personality-compatibility-self-name" className="mb-2 block text-sm text-[var(--app-copy)]">
                    이름 또는 별명
                  </Label>
                  <Input
                    id="personality-compatibility-self-name"
                    value={selfName}
                    onChange={(event) => setSelfName(event.target.value)}
                    placeholder="예: 나, 민지"
                  />
                </div>
                <UnifiedBirthInfoFields
                  idPrefix="personality-compatibility-self"
                  draft={selfDraft}
                  onChange={(patch) => updateDraft('self', patch)}
                  dateInputVariant="select"
                  locationLoading={locationStates.self.status === 'loading'}
                  locationMessage={locationStates.self.message}
                  locationResults={locationStates.self.results}
                  onLocationSearch={() => void searchBirthLocationCoordinates('self')}
                  onPresetSelect={(code) => updateBirthLocation('self', code)}
                  onLocationResultSelect={(result) => applyBirthLocationSearchResult('self', result)}
                />
              </section>
            </div>
          ) : null}

          {activeStep === 'partner' ? (
            <div className="space-y-4">
              <SavedProfileQuickFill
                target="partner"
                profiles={sortedSavedProfiles}
                status={profileLoadStatus}
                onApply={applySavedProfile}
              />
              {profileLoadMessage && profileLoadStatus !== 'error' ? (
                <div className="rounded-2xl border border-[var(--app-jade)]/20 bg-[var(--app-jade)]/8 px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
                  {profileLoadMessage}
                </div>
              ) : null}
              <section className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="app-caption text-[var(--app-jade)]">상대</div>
                    <h2 className="mt-2 text-xl font-bold text-[var(--app-ink)]">상대 정보</h2>
                  </div>
                  <div className="max-w-sm text-left text-xs leading-6 text-[var(--app-copy-soft)] sm:text-right">
                    {partnerSummary}
                  </div>
                </div>
                <div className="mb-5">
                  <Label htmlFor="personality-compatibility-partner-name" className="mb-2 block text-sm text-[var(--app-copy)]">
                    이름 또는 별명
                  </Label>
                  <Input
                    id="personality-compatibility-partner-name"
                    value={partnerName}
                    onChange={(event) => setPartnerName(event.target.value)}
                    placeholder="예: 상대, 배우자, 동업자"
                  />
                </div>
                <UnifiedBirthInfoFields
                  idPrefix="personality-compatibility-partner"
                  draft={partnerDraft}
                  onChange={(patch) => updateDraft('partner', patch)}
                  dateInputVariant="select"
                  locationLoading={locationStates.partner.status === 'loading'}
                  locationMessage={locationStates.partner.message}
                  locationResults={locationStates.partner.results}
                  onLocationSearch={() => void searchBirthLocationCoordinates('partner')}
                  onPresetSelect={(code) => updateBirthLocation('partner', code)}
                  onLocationResultSelect={(result) => applyBirthLocationSearchResult('partner', result)}
                />
              </section>
            </div>
          ) : null}

          {activeStep === 'personality' ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <PersonalityInputPanel
                title="내 성향"
                state={selfPersonality}
                onChange={(patch) => updatePersonality('self', patch)}
              />
              <PersonalityInputPanel
                title="상대 성향"
                state={partnerPersonality}
                onChange={(patch) => updatePersonality('partner', patch)}
              />
            </div>
          ) : null}

          {activeStep === 'question' ? (
            <div className="grid gap-2">
              {QUESTION_OPTIONS.map((item) => (
                <ChoiceRow
                  key={item.value}
                  onClick={() => setQuestionKey(item.value)}
                  selected={questionKey === item.value}
                  title={item.label}
                  description={item.description}
                  trailing={questionKey === item.value ? '선택됨' : undefined}
                />
              ))}
            </div>
          ) : null}

          {activeStep === 'result' ? (
            <div className="space-y-3 rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 text-sm leading-6 text-[var(--gyeol-muted)]">
              <p>
                <strong className="text-[var(--gyeol-text)]">관계 유형</strong>
                <br />
                {RELATIONSHIP_OPTIONS.find((item) => item.value === relationshipType)?.label}
              </p>
              <p>
                <strong className="text-[var(--gyeol-text)]">내 정보</strong>
                <br />
                {selfSummary}
              </p>
              <p>
                <strong className="text-[var(--gyeol-text)]">상대 정보</strong>
                <br />
                {partnerSummary}
              </p>
              <p>
                <strong className="text-[var(--gyeol-text)]">현재 질문</strong>
                <br />
                {selectedQuestion.label}
              </p>
              <SafetyNotice>
                성향궁합은 참고용 관계 이해 콘텐츠입니다. 개인 생년월일시와 상대 정보는 공유 카드나 analytics payload에 노출하지 않습니다.
              </SafetyNotice>
            </div>
          ) : null}
        </StepFlowShell>

        {errorMessage ? (
          <div className="rounded-[1rem] border border-[var(--app-coral)]/24 bg-[var(--app-coral)]/8 px-4 py-3 text-sm leading-7 text-[var(--app-ink)]">
            {errorMessage}
          </div>
        ) : null}

        <StickyActionBar note="입력값은 무료 결과 생성을 위해 이 브라우저에만 임시 보관됩니다.">
          <Button
            type="button"
            variant="secondary"
            onClick={activeStepIndex === 0 ? () => router.push('/compatibility/input') : goToPreviousStep}
          >
            {activeStepIndex === 0 ? '일반 궁합으로' : '이전'}
          </Button>
          <Button
            type="button"
            onClick={activeStep === 'result' ? submitPersonalityCompatibility : goToNextStep}
          >
            {activeStep === 'result' ? '무료 결과 보기' : '다음'}
          </Button>
        </StickyActionBar>
      </MoonlightAppPage>
    </AppShell>
  );
}
