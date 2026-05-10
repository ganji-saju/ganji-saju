'use client';

import Link from 'next/link';
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
import { GangiActionRow, GangiIntro, GangiPageHeader, GangiSection } from '@/components/gangi/gangi-ui';
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
import { cn } from '@/lib/utils';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

type PersonKey = 'self' | 'partner';
type PersonalityInputMode = 'direct' | 'check';
type LocationSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

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
    <section className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5 sm:p-6">
      <div className="mb-5">
        <div className="app-caption text-[var(--app-pink-strong)]">{title}</div>
        <h3 className="mt-2 text-2xl text-[var(--app-ink)]">16유형 성향 입력</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--app-copy-soft)]">
          성향 체크는 참고용 자기이해 콘텐츠이며, 공식 검사나 진단처럼 사용하지 않습니다.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { value: 'direct' as const, label: '16유형 직접 선택', desc: '이미 알고 있는 성향 코드를 고릅니다.' },
          { value: 'check' as const, label: '잘 몰라요. 간단 체크하기', desc: '짧은 선택 문항으로 성향을 추정합니다.' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ mode: option.value })}
            className={cn(
              'gangi-topic-card !min-h-0 !p-4 text-left',
              state.mode === option.value &&
                'border-[var(--app-pink)]/40 bg-[var(--app-pink)]/8 shadow-[0_12px_28px_-24px_rgba(216,27,114,0.8)]'
            )}
            data-active={state.mode === option.value ? 'true' : undefined}
          >
            <h2>{option.label}</h2>
            <p>{option.desc}</p>
          </button>
        ))}
      </div>

      {state.mode === 'direct' ? (
        <div className="mt-5">
          <Label
            htmlFor={`${title === '내 성향' ? 'self' : 'partner'}-personality-type`}
            className="mb-2 block text-sm text-[var(--app-copy)]"
          >
            성향 코드
          </Label>
          <select
            id={`${title === '내 성향' ? 'self' : 'partner'}-personality-type`}
            value={state.typeCode}
            onChange={(event) =>
              onChange({ typeCode: event.target.value as PersonalityTypeCode | '' })
            }
            className="gangi-form-control h-11 w-full px-3 text-sm"
          >
            <option value="">선택해 주세요</option>
            {PERSONALITY_TYPE_CODES.map((code) => {
              const profile = getPersonalityTypeProfile(code);
              return (
                <option key={code} value={code}>
                  {code} · {profile.title}
                </option>
              );
            })}
          </select>
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
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          onChange({ answers: updateAnswers(state.answers, question.id, option.value) })
                        }
                        className={cn(
                          'gangi-birth-card-choice min-h-0 px-3 py-3 text-left',
                          getAnswerValue(state.answers, question.id) === option.value && 'is-selected'
                        )}
                      >
                        <span className="block text-sm font-semibold text-[var(--app-ink)]">
                          {option.label}
                        </span>
                      </button>
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
  const [relationshipType, setRelationshipType] = useState<CompatibilityRelationshipType>('dating');
  const [selfName, setSelfName] = useState('나');
  const [partnerName, setPartnerName] = useState('상대');
  const [selfDraft, setSelfDraft] = useState<UnifiedBirthEntryDraft>(() => createInitialDraft());
  const [partnerDraft, setPartnerDraft] = useState<UnifiedBirthEntryDraft>(() => createInitialDraft());
  const [selfPersonality, setSelfPersonality] = useState<PersonalityState>(() => createPersonalityState());
  const [partnerPersonality, setPartnerPersonality] = useState<PersonalityState>(() => createPersonalityState());
  const [questionKey, setQuestionKey] = useState<PersonalityCompatibilityQuestionKey>('fit');
  const [locationStates, setLocationStates] = useState<Record<PersonKey, LocationState>>({
    self: createLocationState(),
    partner: createLocationState(),
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selfSummary = useMemo(() => formatBirthSummary(selfDraft), [selfDraft]);
  const partnerSummary = useMemo(() => formatBirthSummary(partnerDraft), [partnerDraft]);
  const selectedQuestion = QUESTION_OPTIONS.find((item) => item.value === questionKey) ?? QUESTION_OPTIONS[0];

  useEffect(() => {
    trackMoonlightEvent('personality_compatibility_viewed', {
      source: 'input_page',
    });
  }, []);

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
      <AppPage className="gangi-subpage space-y-6">
        <GangiPageHeader title="성향궁합 입력" backHref="/compatibility" />
        <GangiIntro
          eyebrow="사주×성향 궁합"
          title={
            <>
              두 사람의 정보와 성향을
              <br />
              함께 넣어 준비합니다
            </>
          }
          description="입력 후 무료 결과, 깊이보기 결제, 저장과 공유 카드 흐름까지 이어집니다."
        >
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {['관계 유형', '내 정보', '상대 정보', '성향 입력', '현재 질문'].map((item, index) => (
              <div
                key={item}
                className="rounded-[1rem] border border-[var(--app-line)] bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--app-ink)]"
              >
                <span className="mr-2 text-[var(--app-pink-strong)]">{index + 1}</span>
                {item}
              </div>
            ))}
          </div>
        </GangiIntro>

        {isSubmitted ? (
          <div className="rounded-[1.2rem] border border-[var(--app-jade)]/24 bg-[var(--app-jade)]/10 px-4 py-3 text-sm leading-6 text-[var(--app-ink)]">
            입력값을 임시 저장했습니다. 다음 단계에서 이 payload를 점수 엔진과 리포트 생성 흐름에 연결하면 됩니다.
          </div>
        ) : null}

        <GangiSection
          eyebrow="1단계"
          title="관계 유형을 골라 주세요"
          description="관계에 따라 사주와 성향을 보는 비중이 달라집니다."
          tone="pink"
        >
          <div className="gangi-topic-grid !px-0 !pb-0 !pt-0">
            {RELATIONSHIP_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => selectRelationshipType(item.value)}
                className={cn(
                  'gangi-topic-card',
                  relationshipType === item.value &&
                    'border-[var(--app-pink)]/40 bg-[var(--app-pink)]/8 shadow-[0_12px_28px_-24px_rgba(216,27,114,0.8)]'
                )}
                data-active={relationshipType === item.value ? 'true' : undefined}
              >
                <h2>{item.label}</h2>
                <p>{item.description}</p>
              </button>
            ))}
          </div>
        </GangiSection>

        <GangiSection
          eyebrow="2단계"
          title="내 정보를 입력해 주세요"
          description="기존 사주 입력과 같은 방식으로 생년월일, 양력/음력, 시간, 성별을 받습니다."
        >
          <section className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="app-caption text-[var(--app-pink-strong)]">나</div>
                <h2 className="mt-2 text-2xl text-[var(--app-ink)]">내 정보</h2>
              </div>
              <div className="max-w-sm text-right text-xs leading-6 text-[var(--app-copy-soft)]">
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
        </GangiSection>

        <GangiSection
          eyebrow="3단계"
          title="상대 정보를 입력해 주세요"
          description="상대도 같은 입력 구조를 사용해 이후 점수 엔진에 facts로 넘길 수 있게 준비합니다."
        >
          <section className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="app-caption text-[var(--app-jade)]">상대</div>
                <h2 className="mt-2 text-2xl text-[var(--app-ink)]">상대 정보</h2>
              </div>
              <div className="max-w-sm text-right text-xs leading-6 text-[var(--app-copy-soft)]">
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
        </GangiSection>

        <GangiSection
          eyebrow="4단계"
          title="두 사람의 16유형 성향을 알려 주세요"
          description="직접 선택하거나 간단 체크로 추정할 수 있습니다."
          tone="pink"
        >
          <div className="grid gap-6 xl:grid-cols-2">
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
        </GangiSection>

        <GangiSection
          eyebrow="5단계"
          title="지금 가장 궁금한 질문을 골라 주세요"
          description="현재 질문은 리포트의 해석 초점을 정하는 데만 사용합니다."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {QUESTION_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setQuestionKey(item.value)}
                className={cn(
                  'gangi-topic-card !min-h-0 !p-4 text-left',
                  questionKey === item.value &&
                    'border-[var(--app-pink)]/40 bg-[var(--app-pink)]/8 shadow-[0_12px_28px_-24px_rgba(216,27,114,0.8)]'
                )}
                data-active={questionKey === item.value ? 'true' : undefined}
              >
                <h2>{item.label}</h2>
                <p>{item.description}</p>
              </button>
            ))}
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-[1rem] border border-[var(--app-coral)]/24 bg-[var(--app-coral)]/8 px-4 py-3 text-sm leading-7 text-[var(--app-ink)]">
              {errorMessage}
            </div>
          ) : null}

          <GangiActionRow>
            <button type="button" onClick={submitPersonalityCompatibility} className="gangi-primary-button">
              입력 완료하기
            </button>
            <Link href="/compatibility/input" className="gangi-secondary-button">
              일반 궁합 입력으로
            </Link>
          </GangiActionRow>
        </GangiSection>
      </AppPage>
    </AppShell>
  );
}
