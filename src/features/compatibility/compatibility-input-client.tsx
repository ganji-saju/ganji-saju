'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppPage as MoonlightAppPage } from '@/components/moonlight/AppPage';
import { ChoiceRow } from '@/components/moonlight/ChoiceRow';
import { FusionStrip } from '@/components/moonlight/FusionStrip';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { StepFlowShell } from '@/components/moonlight/StepFlowShell';
import { StickyActionBar } from '@/components/moonlight/StickyActionBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  UnifiedBirthInfoFields,
  type BirthLocationSearchResultLike,
} from '@/components/saju/shared/unified-birth-info-fields';
import { COMPATIBILITY_RELATIONSHIPS, type CompatibilityRelationshipSlug } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  MANUAL_COMPATIBILITY_SESSION_KEY,
  type ManualCompatibilityPayload,
} from '@/features/compatibility/manual-compatibility-storage';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { AppShell } from '@/shared/layout/app-shell';

type PersonKey = 'self' | 'partner';
type CompatibilityInputStep = 'relationship' | 'self' | 'partner' | 'result';
type ProfileLoadStatus = 'idle' | 'loading' | 'ready' | 'anonymous' | 'empty' | 'error';
type LocationSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface CompatibilityInputClientProps {
  initialRelationship: CompatibilityRelationshipSlug;
  hasLoveQuestionPurchase?: boolean;
}

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

const COMPATIBILITY_INPUT_STEPS: Array<{
  key: CompatibilityInputStep;
  title: string;
  description: string;
}> = [
  {
    key: 'relationship',
    title: '관계 유형을 골라 주세요',
    description: '관계에 따라 두 사람의 사주를 읽는 렌즈가 달라집니다.',
  },
  {
    key: 'self',
    title: '내 정보를 확인해 주세요',
    description: '저장된 내 정보를 불러오거나 생년월일시를 새로 입력합니다.',
  },
  {
    key: 'partner',
    title: '상대 정보를 확인해 주세요',
    description: '상대의 생년월일시를 같은 방식으로 입력합니다.',
  },
  {
    key: 'result',
    title: '궁합 결과를 볼 준비가 됐어요',
    description: '입력한 내용을 확인하고 기본 궁합 결과로 이동합니다.',
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

function hasReusableCompatibilityDraft(draft: UnifiedBirthEntryDraft) {
  return Boolean(
    draft.year.trim() &&
      draft.month.trim() &&
      draft.day.trim() &&
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

function inferRelationshipMatch(relationship: string, selected: CompatibilityRelationshipSlug) {
  const value = relationship.trim();

  if (selected === 'lover') return /배우자|연인|남편|아내|부부|재회|썸/.test(value);
  if (selected === 'family') return /부모|엄마|아빠|어머니|아버지|자녀|아들|딸|가족/.test(value);
  if (selected === 'partner') return /동료|파트너|동업|상사|부하|팀원|거래처/.test(value);
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

function SavedProfileQuickFill({
  target,
  profiles,
  status,
  onApply,
}: {
  target?: PersonKey;
  profiles: SavedBirthProfile[];
  status: ProfileLoadStatus;
  onApply: (target: PersonKey, profile: SavedBirthProfile) => void;
}) {
  if (status === 'loading') {
    return (
      <div className="mt-5 rounded-[1.2rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--app-copy-muted)]">
        저장한 사람을 확인하고 있습니다.
      </div>
    );
  }

  if (profiles.length === 0) return null;

  const groups = target
    ? [
        {
          key: target,
          label: target === 'self' ? '내 정보에 넣기' : '상대 정보에 넣기',
          tone: target === 'self' ? 'gold' : 'jade',
        },
      ]
    : [
        { key: 'self' as const, label: '내 정보에 넣기', tone: 'gold' },
        { key: 'partner' as const, label: '상대 정보에 넣기', tone: 'jade' },
      ];

  return (
    <div className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="app-caption text-[var(--gyeol-moon)]">빠른 채우기</div>
          <h3 className="mt-1 text-lg font-semibold text-[var(--gyeol-text)]">
            저장한 사람을 불러올 수 있습니다
          </h3>
        </div>
        <p className="text-xs leading-5 text-[var(--gyeol-muted)]">
          생년월일시는 입력칸에만 적용됩니다.
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div
              className={
                group.tone === 'jade'
                  ? 'mb-2 text-xs font-semibold text-[var(--app-jade)]'
                  : 'mb-2 text-xs font-semibold text-[var(--gyeol-moon)]'
              }
            >
              {group.label}
            </div>
            <div className="grid gap-2">
              {profiles.map((profile) => (
                <ChoiceRow
                  key={`${group.key}-${profile.id}`}
                  onClick={() => onApply(group.key, profile)}
                  leading={profile.source === 'self' ? '나' : '家'}
                  title={profile.nickname}
                  description={profile.detail}
                  trailing="불러오기"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatManualBirthSummary(draft: UnifiedBirthEntryDraft) {
  const parsed = resolveUnifiedBirthInput(draft, { requireGender: false });
  const calendarLabel = draft.calendarType === 'lunar' ? '음력 입력' : '양력 입력';
  const dateLabel = `${draft.year}.${draft.month}.${draft.day}`;
  const genderLabel = draft.gender === 'male' ? '남성' : draft.gender === 'female' ? '여성' : '성별 미선택';

  if (!parsed.ok) {
    return `${calendarLabel} ${dateLabel} · 입력 확인 필요`;
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

export function CompatibilityInputClient({
  initialRelationship,
  hasLoveQuestionPurchase = false,
}: CompatibilityInputClientProps) {
  const router = useRouter();
  const [relationship, setRelationship] = useState<CompatibilityRelationshipSlug>(initialRelationship);
  const [selfName, setSelfName] = useState('나');
  const [partnerName, setPartnerName] = useState('상대');
  const [selfDraft, setSelfDraft] = useState<UnifiedBirthEntryDraft>(() => createInitialDraft());
  const [partnerDraft, setPartnerDraft] = useState<UnifiedBirthEntryDraft>(() => createInitialDraft());
  const [profileLoadStatus, setProfileLoadStatus] = useState<ProfileLoadStatus>('idle');
  const [profileLoadMessage, setProfileLoadMessage] = useState('');
  const [savedProfiles, setSavedProfiles] = useState<SavedBirthProfile[]>([]);
  const [activeStep, setActiveStep] = useState<CompatibilityInputStep>('relationship');
  const [locationStates, setLocationStates] = useState<Record<PersonKey, LocationState>>({
    self: createLocationState(),
    partner: createLocationState(),
  });
  const [errorMessage, setErrorMessage] = useState('');
  const activeStepIndex = COMPATIBILITY_INPUT_STEPS.findIndex((step) => step.key === activeStep);
  const currentStep = COMPATIBILITY_INPUT_STEPS[activeStepIndex] ?? COMPATIBILITY_INPUT_STEPS[0];
  const selected =
    COMPATIBILITY_RELATIONSHIPS.find((item) => item.slug === relationship) ??
    COMPATIBILITY_RELATIONSHIPS[0];
  const selfSummary = useMemo(() => formatManualBirthSummary(selfDraft), [selfDraft]);
  const partnerSummary = useMemo(() => formatManualBirthSummary(partnerDraft), [partnerDraft]);
  const sortedSavedProfiles = useMemo(
    () =>
      [...savedProfiles].sort((left, right) => {
        const leftMatch = inferRelationshipMatch(left.relationship, relationship) ? 0 : 1;
        const rightMatch = inferRelationshipMatch(right.relationship, relationship) ? 0 : 1;

        if (left.source !== right.source) return left.source === 'self' ? -1 : 1;
        if (leftMatch !== rightMatch) return leftMatch - rightMatch;
        return left.label.localeCompare(right.label);
      }),
    [relationship, savedProfiles]
  );

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

        const selfProfile = options.find((profile) => profile.source === 'self');
        if (selfProfile && !hasReusableCompatibilityDraft(selfDraft)) {
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
  }, []);

  function selectRelationship(next: CompatibilityRelationshipSlug) {
    setRelationship(next);
    window.history.replaceState(null, '', `/compatibility/input?relationship=${next}`);
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
    const parsed = resolveUnifiedBirthInput(draft, { requireGender: false });

    if (!parsed.ok) {
      setErrorMessage(`${target === 'self' ? '내 정보' : '상대 정보'}: ${parsed.error}`);
      return false;
    }

    setErrorMessage('');
    return true;
  }

  function goToPreviousStep() {
    const previousStep = COMPATIBILITY_INPUT_STEPS[Math.max(0, activeStepIndex - 1)];
    setErrorMessage('');
    setActiveStep(previousStep.key);
  }

  function goToNextStep() {
    if (activeStep === 'self' && !validateBirthStep('self')) return;
    if (activeStep === 'partner' && !validateBirthStep('partner')) return;

    const nextStep =
      COMPATIBILITY_INPUT_STEPS[
        Math.min(COMPATIBILITY_INPUT_STEPS.length - 1, activeStepIndex + 1)
      ];
    setErrorMessage('');
    setActiveStep(nextStep.key);
  }

  function submitManualCompatibility() {
    const selfParsed = resolveUnifiedBirthInput(selfDraft, { requireGender: false });
    if (!selfParsed.ok) {
      setErrorMessage(`내 정보: ${selfParsed.error}`);
      return;
    }

    const partnerParsed = resolveUnifiedBirthInput(partnerDraft, { requireGender: false });
    if (!partnerParsed.ok) {
      setErrorMessage(`상대 정보: ${partnerParsed.error}`);
      return;
    }

    const payload: ManualCompatibilityPayload = {
      version: 1,
      relationship,
      selfName: selfName.trim() || '나',
      partnerName: partnerName.trim() || '상대',
      selfBirthInput: selfParsed.input,
      partnerBirthInput: partnerParsed.input,
      selfBirthSummary: selfSummary,
      partnerBirthSummary: partnerSummary,
      createdAt: new Date().toISOString(),
    };

    window.sessionStorage.setItem(MANUAL_COMPATIBILITY_SESSION_KEY, JSON.stringify(payload));
    setErrorMessage('');
    const params = new URLSearchParams({ relationship, source: 'manual' });
    if (hasLoveQuestionPurchase) params.set('paid', 'love-question');
    router.push(`/compatibility/result?${params.toString()}`);
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-28 md:pb-12">
      <MoonlightAppPage className="gangi-subpage space-y-5" size="md">
        <PageIntro
          eyebrow="관계"
          title="사주와 관계의 결을 봅니다"
          description="내 정보와 상대 정보를 한 단계씩 입력해 왜 끌리고 어디서 부딪히는지 살펴봅니다."
        />
        <FusionStrip prefixLabel="두 사람 사주" suffixLabel="관계의 결" />
        {hasLoveQuestionPurchase ? (
          <div className="rounded-[1.2rem] border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-700">
            연애 질문 1회 상품이 구매되어 있습니다. 이 화면에서는 추가 결제 없이 두 사람 정보를 넣고 결과로 이어가시면 됩니다.
          </div>
        ) : null}

        <StepFlowShell
          currentStep={activeStepIndex + 1}
          totalSteps={COMPATIBILITY_INPUT_STEPS.length}
          title={currentStep.title}
          description={currentStep.description}
        >
          {activeStep === 'relationship' ? (
            <div className="grid gap-2">
              {COMPATIBILITY_RELATIONSHIPS.map((item) => (
                <ChoiceRow
                  key={item.slug}
                  onClick={() => selectRelationship(item.slug)}
                  selected={item.slug === selected.slug}
                  leading={item.icon}
                  title={item.title}
                  description={item.hook}
                  trailing={item.slug === selected.slug ? '선택됨' : undefined}
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
                  <Label htmlFor="compatibility-self-name" className="mb-2 block text-sm text-[var(--app-copy)]">
                    호칭
                  </Label>
                  <Input
                    id="compatibility-self-name"
                    value={selfName}
                    onChange={(event) => setSelfName(event.target.value)}
                    placeholder="예: 나, 민지"
                  />
                </div>
                <UnifiedBirthInfoFields
                  idPrefix="compatibility-self"
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
                  <Label htmlFor="compatibility-partner-name" className="mb-2 block text-sm text-[var(--app-copy)]">
                    상대 호칭
                  </Label>
                  <Input
                    id="compatibility-partner-name"
                    value={partnerName}
                    onChange={(event) => setPartnerName(event.target.value)}
                    placeholder="예: 배우자, 엄마, 동업자"
                  />
                </div>
                <UnifiedBirthInfoFields
                  idPrefix="compatibility-partner"
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

          {activeStep === 'result' ? (
            <div className="space-y-3 rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 text-sm leading-6 text-[var(--gyeol-muted)]">
              <p>
                <strong className="text-[var(--gyeol-text)]">관계 유형</strong>
                <br />
                {selected.title}
              </p>
              <p>
                <strong className="text-[var(--gyeol-text)]">내 정보</strong>
                <br />
                {selfName.trim() || '나'} · {selfSummary}
              </p>
              <p>
                <strong className="text-[var(--gyeol-text)]">상대 정보</strong>
                <br />
                {partnerName.trim() || '상대'} · {partnerSummary}
              </p>
              <p className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3 text-xs leading-5 text-[var(--gyeol-muted)]">
                비로그인 입력은 현재 브라우저에만 임시 보관됩니다.
              </p>
            </div>
          ) : null}
        </StepFlowShell>

        {errorMessage ? (
          <div className="rounded-[1rem] border border-[var(--app-coral)]/24 bg-[var(--app-coral)]/8 px-4 py-3 text-sm leading-7 text-[var(--app-ink)]">
            {errorMessage}
          </div>
        ) : null}

        <StickyActionBar note="두 사람 생년월일시는 궁합 결과 생성 전까지 이 브라우저에만 임시 보관됩니다.">
          <Button
            type="button"
            variant="secondary"
            onClick={activeStepIndex === 0 ? () => router.push('/compatibility') : goToPreviousStep}
          >
            {activeStepIndex === 0 ? '궁합 허브로' : '이전'}
          </Button>
          <Button
            type="button"
            onClick={activeStep === 'result' ? submitManualCompatibility : goToNextStep}
          >
            {activeStep === 'result' ? '궁합 결과 보기' : '다음'}
          </Button>
        </StickyActionBar>
      </MoonlightAppPage>
    </AppShell>
  );
}
