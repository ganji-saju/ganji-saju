'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  UnifiedBirthInfoFields,
  type BirthLocationSearchResultLike,
} from '@/components/saju/shared/unified-birth-info-fields';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import { HOUR_OPTIONS } from '@/features/home/content';
import { cn } from '@/lib/utils';
import type {
  OnboardingConcern,
  OnboardingFocusTopic,
  OnboardingOccupation,
  OnboardingRelationshipStatus,
} from '@/features/saju-intake/onboarding-storage';
import { shouldAutoSavePersonalProfile } from '@/features/saju-intake/onboarding-storage';
import {
  createEmptyBirthProfile,
  hasCompleteBirthProfile,
  loadBirthProfile,
  normalizeBirthProfile,
  saveBirthProfile,
  type UnifiedBirthProfile,
} from './birth-profile-store';
import type { IntakeIntent } from './intake-intent';

export interface UnifiedIntakeProps {
  intent: IntakeIntent | null;
  submitting?: boolean;
  onResolve: (profile: UnifiedBirthProfile) => void;
  // Task6b — 인입 퍼널 회귀 수정: 폼 최초 상호작용 시 1회 호출(호출부가 자기 payload로 발화).
  onStarted?: () => void;
}

const CTA_LABEL: Record<IntakeIntent, string> = {
  saju: '사주 풀이 보기',
  today: '오늘 운세 보기',
};

interface ProfileApiResponse {
  authenticated: boolean;
  profile: {
    displayName: string;
    birthYear: number | null;
    birthMonth: number | null;
    birthDay: number | null;
    birthHour: number | null;
    birthLocationCode: string | null;
    birthLocationLabel: string;
    birthLatitude: number | null;
    birthLongitude: number | null;
    solarTimeMode: 'standard' | 'longitude';
    calendarType: 'solar' | 'lunar';
    timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
    gender: 'male' | 'female' | null;
  } | null;
  // 2026-08-31 — 가족 사주 불러오기(대표 제보: "가족 등록했는데 사주에서 불러오는 화면이 없다").
  //   /api/profile 이 이미 내려주던 가족 목록을 인테이크에서도 소비한다.
  familyProfiles?: Array<{
    id: string;
    label: string;
    relationship: string;
    birthYear: number | null;
    birthMonth: number | null;
    birthDay: number | null;
    birthHour: number | null;
    birthLocationCode: string | null;
    birthLocationLabel: string;
    birthLatitude: number | null;
    birthLongitude: number | null;
    solarTimeMode: 'standard' | 'longitude';
    calendarType: 'solar' | 'lunar';
    timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
    gender: 'male' | 'female' | null;
  }>;
}

type IntakeFamilyOption = NonNullable<ProfileApiResponse['familyProfiles']>[number];

interface BirthLocationSearchResponse {
  ok: boolean;
  error?: string;
  items?: BirthLocationSearchResultLike[];
}

// saju-intake-page.tsx SituationChipGroup 이식 — 관심주제·현재상황 칩 그룹 공용 렌더.
function IntakeChipGroup<T extends string>({
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
      <div className="flex items-center gap-1.5 text-[14.4px] font-bold text-[var(--app-copy-muted)]">
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
                'rounded-[12px] border px-3.5 py-1.5 text-[14.4px] font-bold transition-all active:scale-95',
                selected
                  ? 'border-[var(--app-pink-strong)] bg-[var(--app-pink-strong)] text-white shadow-[0_4px_12px_rgba(179,55,42,0.25)]'
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

const FOCUS_TOPIC_OPTIONS: ReadonlyArray<{ value: OnboardingFocusTopic; label: string; emoji: string }> = [
  { value: 'today', label: '오늘 조언', emoji: '🌤' },
  { value: 'love', label: '연애', emoji: '💑' },
  { value: 'wealth', label: '재물', emoji: '💰' },
  { value: 'career', label: '일·커리어', emoji: '💼' },
  { value: 'relationship', label: '관계', emoji: '🤝' },
];

const RELATIONSHIP_OPTIONS: ReadonlyArray<{ value: OnboardingRelationshipStatus; label: string; emoji: string }> = [
  { value: 'single', label: '솔로', emoji: '💛' },
  { value: 'dating', label: '연애 중', emoji: '💑' },
  { value: 'married', label: '기혼', emoji: '💍' },
  { value: 'separated', label: '이별·정리 중', emoji: '🍂' },
];

const OCCUPATION_OPTIONS: ReadonlyArray<{ value: OnboardingOccupation; label: string; emoji: string }> = [
  { value: 'employee', label: '직장인', emoji: '💼' },
  { value: 'self-employed', label: '자영업·프리랜서', emoji: '🛠' },
  { value: 'student', label: '학생', emoji: '📚' },
  { value: 'homemaker', label: '주부', emoji: '🏠' },
  { value: 'job-seeking', label: '구직 중', emoji: '🔎' },
  { value: 'other', label: '기타', emoji: '✨' },
];

const CONCERN_OPTIONS: ReadonlyArray<{ value: OnboardingConcern; label: string; emoji: string }> = [
  { value: 'business', label: '사업·이직', emoji: '🚀' },
  { value: 'romance', label: '결혼·연애', emoji: '💞' },
  { value: 'family', label: '자녀·가족', emoji: '👨‍👩‍👧' },
  { value: 'health', label: '건강·멘탈', emoji: '🩺' },
  { value: 'wealth', label: '재물·투자', emoji: '💰' },
  { value: 'other', label: '직접 입력', emoji: '✍️' },
];

// saju-intake-page.tsx formatRecentGuestDetail 이식 — UnifiedBirthProfile 요약 문구.
function formatBirthProfileSummary(profile: UnifiedBirthProfile) {
  const calendarLabel = profile.calendarType === 'lunar' ? '음력' : '양력';
  const dateLabel = `${profile.year}.${profile.month}.${profile.day}`;
  const hourLabel = profile.unknownBirthTime ? '시간 미입력' : `${profile.hour}시`;
  const genderLabel =
    profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '성별 미선택';
  const locationLabel = profile.birthLocationLabel
    ? ` · ${profile.birthLocationLabel}${profile.solarTimeMode === 'longitude' ? ' 진태양시' : ''}`
    : '';
  return `${calendarLabel} ${dateLabel} · ${hourLabel} · ${genderLabel}${locationLabel}`;
}

export function UnifiedIntake({ intent, submitting = false, onResolve, onStarted }: UnifiedIntakeProps) {
  // SSR 안전: 초기 state 는 서버·클라 동일한 빈 프로필로 결정론적 렌더(localStorage 는 마운트 후 effect 에서 seed).
  //   render-time 에 localStorage 를 읽으면 서버(null)↔클라(저장값) 불일치로 hydration mismatch 발생.
  const [profile, setProfile] = useState<UnifiedBirthProfile>(createEmptyBirthProfile);
  // 기본은 입력폼 펼침(빈 폼). 저장된 완전한 프로필이 마운트 후 로드되면 effect 가 요약카드(false)로 전환.
  const [formExpanded, setFormExpanded] = useState(true);
  // 가족 사주 불러오기 — 2026-08-31 v2: 미완성 가족도 '숨기지 말고' 비활성으로 보여준다
  //   (배우자가 조용히 사라져 "왜 누락되지" 제보가 된 원인 = 침묵 필터). 본인 칩도 추가
  //   (가족을 눌렀다가 내 정보로 돌아오는 길).
  const [familyOptions, setFamilyOptions] = useState<IntakeFamilyOption[]>([]);
  const [ownOption, setOwnOption] = useState<ProfileApiResponse['profile']>(null);
  const [showInterests, setShowInterests] = useState(false);
  const [error, setError] = useState('');

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationResults, setLocationResults] = useState<BirthLocationSearchResultLike[]>([]);

  const hasUserEditedRef = useRef(false);
  const profileFetchAttemptedRef = useRef(false);
  // Task6b — birth_form_started once-guard: 마운트당 최초 상호작용 1회만 onStarted 호출.
  const startedFiredRef = useRef(false);
  function fireStarted() {
    if (startedFiredRef.current) return;
    startedFiredRef.current = true;
    onStarted?.();
  }

  // 프리필 우선순위(마운트 후, hydration mismatch 방지 위해 render-time 이 아닌 effect 에서):
  //   (1) 게스트 로컬 프로필(localStorage)을 먼저 sync seed,
  //   (2) 로그인 사용자면 /api/profile 결과가 로컬 값을 override.
  useEffect(() => {
    if (profileFetchAttemptedRef.current) return;
    profileFetchAttemptedRef.current = true;

    // (1) localStorage seed — sync 이므로 아래 async /api/profile override 보다 항상 먼저 반영된다.
    const stored = loadBirthProfile();
    if (stored && hasCompleteBirthProfile(stored) && !hasUserEditedRef.current) {
      setProfile(stored);
      setFormExpanded(false);
    }

    // (2) 로그인 사용자면 /api/profile 이 localStorage 값을 덮어쓴다.
    (async () => {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        const data = (await response.json().catch(() => null)) as ProfileApiResponse | null;

        // 가족 목록은 본인 프로필 완성 여부와 무관하게 채운다(불러오기 칩 노출용).
        //   미완성(출생정보 결손) 가족도 목록에 남긴다 — 렌더에서 비활성+안내로 표시.
        if (response.ok && data?.authenticated) {
          setFamilyOptions(data.familyProfiles ?? []);
          setOwnOption(data.profile);
        }

        if (
          !response.ok ||
          !data?.authenticated ||
          !data.profile?.birthYear ||
          !data.profile.birthMonth ||
          !data.profile.birthDay
        ) {
          return;
        }

        const apiProfile = data.profile;
        const apiBirthPartial = normalizeBirthProfile({
          ...createEmptyBirthProfile(),
          name: apiProfile.displayName ?? '',
          calendarType: apiProfile.calendarType ?? 'solar',
          year: String(apiProfile.birthYear ?? ''),
          month: String(apiProfile.birthMonth ?? ''),
          day: String(apiProfile.birthDay ?? ''),
          hour: apiProfile.birthHour === null ? '' : String(apiProfile.birthHour),
          unknownBirthTime: apiProfile.birthHour === null,
          gender: apiProfile.gender ?? '',
          birthLocationCode: apiProfile.birthLocationCode ?? '',
          birthLocationLabel: apiProfile.birthLocationLabel ?? '',
          birthLatitude: apiProfile.birthLatitude === null ? '' : String(apiProfile.birthLatitude),
          birthLongitude: apiProfile.birthLongitude === null ? '' : String(apiProfile.birthLongitude),
          timeRule: apiProfile.timeRule ?? 'standard',
          solarTimeMode: apiProfile.solarTimeMode ?? 'standard',
        });

        if (!hasCompleteBirthProfile(apiBirthPartial)) return;
        if (hasUserEditedRef.current) return;

        setProfile((cur) => ({
          ...cur,
          name: apiBirthPartial.name || cur.name,
          calendarType: apiBirthPartial.calendarType,
          year: apiBirthPartial.year,
          month: apiBirthPartial.month,
          day: apiBirthPartial.day,
          hour: apiBirthPartial.hour,
          unknownBirthTime: apiBirthPartial.unknownBirthTime,
          gender: apiBirthPartial.gender,
          birthLocationCode: apiBirthPartial.birthLocationCode,
          birthLocationLabel: apiBirthPartial.birthLocationLabel,
          birthLatitude: apiBirthPartial.birthLatitude,
          birthLongitude: apiBirthPartial.birthLongitude,
          timeRule: apiBirthPartial.timeRule,
          solarTimeMode: apiBirthPartial.solarTimeMode,
        }));
        setFormExpanded(false);
      } catch {
        // 네트워크 오류 시 게스트 로컬 프로필(이미 초기 state 반영)을 유지.
      }
    })();
  }, []);

  const birthDraft: UnifiedBirthEntryDraft = useMemo(
    () => ({
      calendarType: profile.calendarType,
      year: profile.year,
      month: profile.month,
      day: profile.day,
      hour: profile.unknownBirthTime ? '' : profile.hour,
      minute: '',
      unknownBirthTime: profile.unknownBirthTime,
      gender: profile.gender,
      birthLocationCode: profile.birthLocationCode,
      birthLocationLabel: profile.birthLocationLabel,
      birthLatitude: profile.birthLatitude,
      birthLongitude: profile.birthLongitude,
      timeRule: profile.timeRule,
      solarTimeMode: profile.solarTimeMode,
    }),
    [profile]
  );

  function patchBirth(patch: Partial<UnifiedBirthEntryDraft>) {
    hasUserEditedRef.current = true;
    setProfile((cur) => ({
      ...cur,
      ...(patch.calendarType !== undefined ? { calendarType: patch.calendarType } : {}),
      ...(patch.timeRule !== undefined ? { timeRule: patch.timeRule } : {}),
      ...(patch.year !== undefined ? { year: patch.year } : {}),
      ...(patch.month !== undefined ? { month: patch.month } : {}),
      ...(patch.day !== undefined ? { day: patch.day } : {}),
      ...(patch.hour !== undefined ? { hour: patch.hour } : {}),
      ...(patch.unknownBirthTime !== undefined ? { unknownBirthTime: patch.unknownBirthTime } : {}),
      ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
      ...(patch.birthLocationCode !== undefined ? { birthLocationCode: patch.birthLocationCode } : {}),
      ...(patch.birthLocationLabel !== undefined ? { birthLocationLabel: patch.birthLocationLabel } : {}),
      ...(patch.birthLatitude !== undefined ? { birthLatitude: patch.birthLatitude } : {}),
      ...(patch.birthLongitude !== undefined ? { birthLongitude: patch.birthLongitude } : {}),
      // minute 은 UnifiedBirthProfile 에 보관하지 않음(store 정책) — UnifiedBirthInfoFields 내부 draft 로만 존재.
    }));
  }

  async function handleLocationSearch() {
    hasUserEditedRef.current = true;
    const query = profile.birthLocationLabel.trim();
    if (query.length < 2) {
      setLocationMessage('출생 지역을 두 글자 이상 입력해 주세요.');
      setLocationResults([]);
      return;
    }

    setLocationLoading(true);
    setLocationMessage('');
    setLocationResults([]);

    try {
      const response = await fetch(`/api/geo/birth-location?q=${encodeURIComponent(query)}`, {
        cache: 'force-cache',
      });
      const data = (await response.json().catch(() => null)) as BirthLocationSearchResponse | null;

      if (!response.ok || !data?.ok) {
        setLocationMessage(data?.error ?? '지역 좌표를 찾지 못했습니다.');
        return;
      }

      const items = data.items ?? [];
      setLocationResults(items);
      setLocationMessage(
        items.length > 0
          ? '가장 가까운 지역을 골라 위도와 경도를 적용해 주세요.'
          : '조건에 맞는 지역을 찾지 못했습니다. 시/군/구 이름을 조금 더 구체적으로 적어주세요.'
      );
    } catch {
      setLocationMessage('지역 좌표를 찾는 중 네트워크 오류가 있었습니다.');
    } finally {
      setLocationLoading(false);
    }
  }

  function handlePresetSelect(code: string) {
    hasUserEditedRef.current = true;
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
    setProfile((cur) => ({
      ...cur,
      birthLocationCode: code,
      birthLocationLabel: preset?.label ?? '',
      birthLatitude: preset ? String(preset.latitude) : '',
      birthLongitude: preset ? String(preset.longitude) : '',
    }));
    setLocationResults([]);
    setLocationMessage('');
  }

  // saju-intake-page.tsx applyBirthLocationSearchResult 이식.
  function handleLocationResultSelect(result: BirthLocationSearchResultLike) {
    hasUserEditedRef.current = true;
    setProfile((cur) => ({
      ...cur,
      birthLocationCode: 'custom',
      birthLocationLabel: result.label,
      birthLatitude: String(result.latitude),
      birthLongitude: String(result.longitude),
    }));
    setLocationResults([]);
    setLocationMessage(`${result.label} 좌표를 적용했습니다.`);
  }

  function handleSubmit() {
    const resolved = resolveUnifiedBirthInput(birthDraft);
    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }
    setError('');
    // 2026-08-31 — 가족 사주를 본 뒤 재방문하면 폼이 '가족이름님 정보로 볼게요'로 뜨던 문제.
    //   이 저장소(localStorage)는 "내 정보" 자동채움용이라 가족 제출은 남기지 않는다
    //   (서버 프로필 자동저장이 같은 가드를 쓰는 것과 대칭 — submit-saju.ts).
    if (shouldAutoSavePersonalProfile(profile.loadedProfileSource)) saveBirthProfile(profile);
    onResolve(profile);
  }

  // 2026-08-31 — 칩 클릭 = 그 사람(본인/가족)의 출생정보로 폼을 채운다(자동입력과 같은 매핑).
  //   이후 늦게 도착하는 /api/profile 본인 응답이 덮어쓰지 않게 편집 플래그를 세운다.
  function applyLoadedFields(
    fields: NonNullable<ProfileApiResponse['profile']> | IntakeFamilyOption,
    name: string,
    source: 'self' | 'family'
  ) {
    hasUserEditedRef.current = true;
    fireStarted();
    const filled = normalizeBirthProfile({
      ...createEmptyBirthProfile(),
      name,
      calendarType: fields.calendarType ?? 'solar',
      year: String(fields.birthYear ?? ''),
      month: String(fields.birthMonth ?? ''),
      day: String(fields.birthDay ?? ''),
      hour: fields.birthHour === null ? '' : String(fields.birthHour),
      unknownBirthTime: fields.birthHour === null,
      gender: fields.gender ?? '',
      birthLocationCode: fields.birthLocationCode ?? '',
      birthLocationLabel: fields.birthLocationLabel ?? '',
      birthLatitude: fields.birthLatitude === null ? '' : String(fields.birthLatitude),
      birthLongitude: fields.birthLongitude === null ? '' : String(fields.birthLongitude),
      timeRule: fields.timeRule ?? 'standard',
      solarTimeMode: fields.solarTimeMode ?? 'standard',
    });
    // 🔴 소스 표기 — 'family' 면 제출 시 본인 프로필 자동저장을 건너뛴다(덮어쓰기 사고 방지).
    setProfile((cur) => ({ ...cur, ...filled, loadedProfileSource: source }));
    setError('');
    // 성별 등 미입력이 남았으면 폼을 펼쳐 바로 채우게, 완성이면 요약 카드로.
    setFormExpanded(!hasCompleteBirthProfile(filled));
  }

  const hasApiBirthCore = (
    fields: { birthYear: number | null; birthMonth: number | null; birthDay: number | null } | null
  ) => Boolean(fields?.birthYear && fields.birthMonth && fields.birthDay);
  const incompleteFamilyExists = familyOptions.some((member) => !hasApiBirthCore(member));

  return (
    <div className="unified-intake grid gap-5">
      {familyOptions.length > 0 || hasApiBirthCore(ownOption) ? (
        <div className="rounded-[1.1rem] border border-[var(--app-gold)]/40 bg-[var(--app-surface-strong)] px-4 py-3.5">
          <div className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-gold-text)]">
            가족 사주 불러오기
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {hasApiBirthCore(ownOption) && ownOption ? (
              <button
                type="button"
                onClick={() => applyLoadedFields(ownOption, ownOption.displayName || '', 'self')}
                className="inline-flex items-center gap-1 rounded-[999px] border border-[var(--app-pink)]/45 bg-[var(--app-pink-soft)] px-3.5 py-1.5 text-[14.5px] font-extrabold text-[var(--app-pink-strong)]"
              >
                {ownOption.displayName || '내 정보'}
                <span className="text-[12px] font-bold text-[var(--app-copy-soft)]">본인</span>
              </button>
            ) : null}
            {familyOptions.map((member) =>
              hasApiBirthCore(member) ? (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => applyLoadedFields(member, member.label, 'family')}
                  className="inline-flex items-center gap-1 rounded-[999px] border border-[var(--app-line)] bg-white px-3.5 py-1.5 text-[14.5px] font-bold text-[var(--app-ink)]"
                >
                  {member.label}
                  <span className="text-[12px] font-bold text-[var(--app-copy-soft)]">
                    {member.relationship}
                  </span>
                </button>
              ) : (
                // 미완성 가족을 숨기면 "왜 누락되지"가 된다 — 비활성으로 보여주고 채울 곳을 알려준다.
                <span
                  key={member.id}
                  className="inline-flex items-center gap-1 rounded-[999px] border border-dashed border-[var(--app-line-strong)] bg-[var(--app-surface-muted)] px-3.5 py-1.5 text-[14.5px] font-bold text-[var(--app-copy-soft)]"
                  title="출생정보가 비어 있어 불러올 수 없어요"
                >
                  {member.label}
                  <span className="text-[12px] font-bold">{member.relationship} · 정보 미완성</span>
                </span>
              )
            )}
          </div>
          {incompleteFamilyExists ? (
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-soft)]">
              ‘정보 미완성’ 가족은{' '}
              <a href="/my/profile" className="font-extrabold text-[var(--app-pink-strong)] underline">
                MY &gt; 프로필
              </a>
              에서 생년월일을 채우면 바로 불러올 수 있어요.
            </p>
          ) : null}
        </div>
      ) : null}
      {!formExpanded ? (
        <div className="rounded-[1.1rem] border border-[var(--app-pink)]/28 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(17,17,20,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-[var(--app-ink)]">
                {profile.name ? `${profile.name}님 정보로 볼게요` : '저장된 정보로 볼게요'}
              </div>
              <p className="mt-2 rounded-[0.9rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-sm leading-6 text-[var(--app-copy)]">
                {formatBirthProfileSummary(profile)}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                // 늦게 도착한 /api/profile 응답이 편집 의도를 덮어써 다시 접히지 않도록 편집 플래그를 세운다.
                hasUserEditedRef.current = true;
                setFormExpanded(true);
              }}
              variant="secondary"
              size="sm"
            >
              정보 바꾸기
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="unified-intake-name" className="gangi-birth-label">
              이름(선택)
            </Label>
            <Input
              id="unified-intake-name"
              value={profile.name}
              maxLength={20}
              placeholder="이름을 입력하시면 결과에 반영돼요"
              autoComplete="off"
              onChange={(event) => {
                hasUserEditedRef.current = true;
                fireStarted();
                const value = event.target.value.slice(0, 20);
                setProfile((cur) => ({ ...cur, name: value }));
              }}
              className="mt-1.5 gangi-form-control gangi-birth-input px-3 text-base"
            />
          </div>

          <UnifiedBirthInfoFields
            draft={birthDraft}
            onChange={patchBirth}
            onStarted={() => {
              hasUserEditedRef.current = true;
              fireStarted();
            }}
            visibleSections={['date', 'gender', 'location-time']}
            /* 분(minute) 은 UnifiedBirthProfile 에 없어 내장 시간 picker 의 분 입력이 깨짐.
               앱 전역이 분을 버리는 관례를 따라 내장 picker 를 숨기고 시(hour) 전용 picker 를 직접 렌더한다. */
            hideTimePicker
            locationLoading={locationLoading}
            locationMessage={locationMessage}
            locationResults={locationResults}
            onLocationSearch={handleLocationSearch}
            onPresetSelect={handlePresetSelect}
            onLocationResultSelect={handleLocationResultSelect}
          />

          {/* 시(hour) 전용 picker — 분 입력 없이 시각만 선택. HOUR_OPTIONS 로 '모름' + 0~23시. */}
          <div className="gangi-birth-field">
            <Label htmlFor="unified-intake-hour" className="gangi-birth-label">
              태어난 시각
            </Label>
            <select
              id="unified-intake-hour"
              value={profile.unknownBirthTime ? '' : profile.hour}
              onChange={(event) => {
                hasUserEditedRef.current = true;
                fireStarted();
                const value = event.target.value;
                setProfile((cur) => ({
                  ...cur,
                  hour: value,
                  unknownBirthTime: value === '',
                }));
              }}
              className="gangi-form-control gangi-birth-input px-3 text-base"
            >
              {HOUR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="mt-2.5 flex items-center gap-2 text-[15px] text-[var(--app-copy-muted)]">
              <input
                type="checkbox"
                checked={profile.unknownBirthTime}
                onChange={(event) => {
                  hasUserEditedRef.current = true;
                  fireStarted();
                  const checked = event.target.checked;
                  setProfile((cur) => ({
                    ...cur,
                    unknownBirthTime: checked,
                    hour: checked ? '' : cur.hour,
                  }));
                }}
                className="h-4 w-4 rounded border-[var(--app-line)] accent-[var(--app-pink)]"
              />
              태어난 시간을 정확히 모르겠어요
            </label>
          </div>
        </>
      )}

      <div className="rounded-[1.05rem] border border-[var(--app-line)] bg-white">
        <button
          type="button"
          onClick={() => setShowInterests((value) => !value)}
          aria-expanded={showInterests}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[15px] font-bold text-[var(--app-ink)]"
        >
          <span>관심 주제·상황 (선택)</span>
          <span aria-hidden="true" className="text-[var(--app-copy-muted)]">
            {showInterests ? '▾' : '▸'}
          </span>
        </button>
        {showInterests ? (
          <div className="grid gap-3.5 border-t border-[var(--app-line)] px-4 py-4">
            <IntakeChipGroup
              label="관심 주제"
              icon="🎯"
              value={profile.focusTopic}
              onChange={(next) =>
                setProfile((cur) => ({ ...cur, focusTopic: next === '' ? 'today' : next }))
              }
              options={FOCUS_TOPIC_OPTIONS}
            />
            <IntakeChipGroup
              label="현재 관계"
              icon="💑"
              value={profile.relationshipStatus}
              onChange={(next) => setProfile((cur) => ({ ...cur, relationshipStatus: next }))}
              options={RELATIONSHIP_OPTIONS}
            />
            <IntakeChipGroup
              label="현재 하시는 일"
              icon="💼"
              value={profile.occupation}
              onChange={(next) => setProfile((cur) => ({ ...cur, occupation: next }))}
              options={OCCUPATION_OPTIONS}
            />
            <IntakeChipGroup
              label="요즘 가장 큰 고민"
              icon="💭"
              value={profile.currentConcern}
              onChange={(next) => setProfile((cur) => ({ ...cur, currentConcern: next }))}
              options={CONCERN_OPTIONS}
            />
            {profile.currentConcern === 'other' ? (
              <input
                type="text"
                value={profile.concernNote}
                onChange={(event) =>
                  setProfile((cur) => ({ ...cur, concernNote: event.target.value.slice(0, 80) }))
                }
                placeholder="고민을 짧게 적어주세요 (최대 80자)"
                className="motion-input-effect h-11 w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3 text-[15.5px] text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-[14.4px] font-medium text-[var(--app-coral,#e11d48)]">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        size="lg"
        className="h-12 w-full rounded-[14px] text-[17.3px] font-extrabold"
      >
        {submitting ? '준비하는 중...' : intent ? CTA_LABEL[intent] : '결과 보기'}
      </Button>
    </div>
  );
}
