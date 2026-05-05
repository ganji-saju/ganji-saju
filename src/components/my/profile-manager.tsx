'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  UnifiedBirthInfoFields,
  type BirthLocationSearchResultLike,
} from '@/components/saju/shared/unified-birth-info-fields';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import type { FamilyProfile, UserProfile } from '@/lib/profile';
import type { UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';

const RELATIONSHIP_OPTIONS = [
  '배우자',
  '연인',
  '부모',
  '자녀',
  '형제자매',
  '친구',
  '동료',
  '기타',
] as const;

interface ProfileManagerProps {
  initialProfile: UserProfile;
  initialFamilyProfiles: FamilyProfile[];
}

interface BirthLocationSearchResult extends BirthLocationSearchResultLike {}

interface BirthLocationSearchResponse {
  ok: boolean;
  error?: string;
  items?: BirthLocationSearchResult[];
}

type BaseBirthFormState = UnifiedBirthEntryDraft & {
  note: string;
};

type ProfileFormState = BaseBirthFormState & {
  displayName: string;
};

type FamilyFormState = BaseBirthFormState & {
  label: string;
  relationship: string;
};

type LocationSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

function toProfileFormState(profile: UserProfile): ProfileFormState {
  return {
    displayName: profile.displayName,
    calendarType: profile.calendarType,
    timeRule: profile.timeRule,
    year: profile.birthYear ? String(profile.birthYear) : '',
    month: profile.birthMonth ? String(profile.birthMonth) : '',
    day: profile.birthDay ? String(profile.birthDay) : '',
    hour: profile.birthHour === null ? '' : String(profile.birthHour),
    minute: profile.birthMinute === null ? '' : String(profile.birthMinute),
    unknownBirthTime: profile.birthHour === null,
    gender: profile.gender ?? '',
    birthLocationCode: profile.birthLocationCode ?? '',
    birthLocationLabel: profile.birthLocationLabel,
    birthLatitude: profile.birthLatitude === null ? '' : String(profile.birthLatitude),
    birthLongitude: profile.birthLongitude === null ? '' : String(profile.birthLongitude),
    note: profile.note,
  };
}

function toFamilyFormState(profile: FamilyProfile): FamilyFormState {
  return {
    label: profile.label,
    relationship: profile.relationship,
    calendarType: profile.calendarType,
    timeRule: profile.timeRule,
    year: profile.birthYear ? String(profile.birthYear) : '',
    month: profile.birthMonth ? String(profile.birthMonth) : '',
    day: profile.birthDay ? String(profile.birthDay) : '',
    hour: profile.birthHour === null ? '' : String(profile.birthHour),
    minute: profile.birthMinute === null ? '' : String(profile.birthMinute),
    unknownBirthTime: profile.birthHour === null,
    gender: profile.gender ?? '',
    birthLocationCode: profile.birthLocationCode ?? '',
    birthLocationLabel: profile.birthLocationLabel,
    birthLatitude: profile.birthLatitude === null ? '' : String(profile.birthLatitude),
    birthLongitude: profile.birthLongitude === null ? '' : String(profile.birthLongitude),
    note: profile.note,
  };
}

function toNumberOrNull(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFamilyProfileFromForm(
  id: string,
  form: FamilyFormState,
  createdAt: string
): FamilyProfile {
  const birthHour = form.unknownBirthTime ? null : toNumberOrNull(form.hour);
  const hasLocation = Boolean(
    form.birthLocationCode ||
      form.birthLocationLabel ||
      form.birthLatitude ||
      form.birthLongitude
  );

  return {
    id,
    label: form.label.trim(),
    relationship: form.relationship.trim(),
    calendarType: form.calendarType,
    timeRule: form.timeRule,
    birthYear: toNumberOrNull(form.year),
    birthMonth: toNumberOrNull(form.month),
    birthDay: toNumberOrNull(form.day),
    birthHour,
    birthMinute:
      form.unknownBirthTime || birthHour === null ? null : toNumberOrNull(form.minute),
    birthLocationCode: form.birthLocationCode || null,
    birthLocationLabel: form.birthLocationLabel.trim(),
    birthLatitude: toNumberOrNull(form.birthLatitude),
    birthLongitude: toNumberOrNull(form.birthLongitude),
    solarTimeMode: form.timeRule === 'trueSolarTime' && hasLocation ? 'longitude' : 'standard',
    gender:
      form.gender === 'male' || form.gender === 'female'
        ? form.gender
        : null,
    note: form.note.trim(),
    createdAt,
  };
}

function formatBirthSummary(profile: {
  calendarType: 'solar' | 'lunar';
  timeRule: UnifiedBirthEntryDraft['timeRule'];
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthHour: number | null;
  birthMinute: number | null;
  birthLocationLabel?: string;
}) {
  if (!profile.birthYear || !profile.birthMonth || !profile.birthDay) {
    return '생년월일 미입력';
  }

  const calendarLabel = profile.calendarType === 'lunar' ? '음력' : '양력';
  const hourLabel =
    profile.birthHour === null
      ? '시간 미입력'
      : `${profile.birthHour}시${
          profile.birthMinute === null
            ? ''
            : ` ${String(profile.birthMinute).padStart(2, '0')}분`
        }`;
  const locationLabel = profile.birthLocationLabel ? ` · ${profile.birthLocationLabel}` : '';
  const timeRuleLabel =
    profile.timeRule === 'trueSolarTime'
      ? ' · 진태양시'
      : profile.timeRule === 'nightZi'
        ? ' · 야자시'
        : profile.timeRule === 'earlyZi'
          ? ' · 조자시'
          : '';

  return `${calendarLabel} ${profile.birthYear}.${profile.birthMonth}.${profile.birthDay} · ${hourLabel}${locationLabel}${timeRuleLabel}`;
}

const EMPTY_FAMILY_FORM: FamilyFormState = {
  label: '',
  relationship: RELATIONSHIP_OPTIONS[0],
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
  note: '',
};

function ManagedBirthFields({
  draft,
  onChange,
  helperText,
  dateInputVariant,
}: {
  draft: UnifiedBirthEntryDraft;
  onChange: (patch: Partial<UnifiedBirthEntryDraft>) => void;
  helperText: string;
  dateInputVariant?: 'input' | 'select';
}) {
  const [locationStatus, setLocationStatus] = useState<LocationSearchStatus>('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationResults, setLocationResults] = useState<BirthLocationSearchResult[]>([]);

  async function handleLocationSearch() {
    const query = draft.birthLocationLabel.trim();
    if (query.length < 2) {
      setLocationStatus('error');
      setLocationMessage('출생 지역을 두 글자 이상 입력해 주세요.');
      setLocationResults([]);
      return;
    }

    setLocationStatus('loading');
    setLocationMessage('');
    setLocationResults([]);

    try {
      const response = await fetch(`/api/geo/birth-location?q=${encodeURIComponent(query)}`, {
        cache: 'force-cache',
      });
      const data = (await response.json().catch(() => null)) as BirthLocationSearchResponse | null;

      if (!response.ok || !data?.ok) {
        setLocationStatus('error');
        setLocationMessage(data?.error ?? '지역 좌표를 찾지 못했습니다.');
        return;
      }

      const items = data.items ?? [];
      setLocationResults(items);
      setLocationStatus(items.length > 0 ? 'ready' : 'empty');
      setLocationMessage(
        items.length > 0
          ? '가장 가까운 지역을 골라 위도와 경도를 적용해 주세요.'
          : '검색 결과가 없습니다. 시/군/구 이름을 조금 더 구체적으로 적어주세요.'
      );
    } catch {
      setLocationStatus('error');
      setLocationMessage('지역 좌표를 찾는 중 네트워크 오류가 있었습니다.');
    }
  }

  function applyPresetLocation(code: string) {
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
    onChange({
      birthLocationCode: code,
      birthLocationLabel: code === 'custom' ? draft.birthLocationLabel : preset?.label ?? '',
      birthLatitude: code === 'custom' ? draft.birthLatitude : preset ? String(preset.latitude) : '',
      birthLongitude: code === 'custom' ? draft.birthLongitude : preset ? String(preset.longitude) : '',
    });
    setLocationStatus('idle');
    setLocationMessage('');
    setLocationResults([]);
  }

  return (
    <div className="space-y-4">
      <UnifiedBirthInfoFields
        draft={draft}
        onChange={onChange}
        dateInputVariant={dateInputVariant}
        locationLoading={locationStatus === 'loading'}
        locationMessage={locationMessage}
        locationResults={locationResults}
        onLocationSearch={handleLocationSearch}
        onPresetSelect={applyPresetLocation}
        onLocationResultSelect={(item) => {
          onChange({
            birthLocationCode: 'custom',
            birthLocationLabel: item.label,
            birthLatitude: String(item.latitude),
            birthLongitude: String(item.longitude),
          });
          setLocationResults([]);
          setLocationStatus('ready');
          setLocationMessage(`출생지로 ${item.displayName}를 적용했습니다.`);
        }}
      />
      <div className="rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--app-copy-muted)]">
        {helperText}
      </div>
    </div>
  );
}

export default function ProfileManager({
  initialProfile,
  initialFamilyProfiles,
}: ProfileManagerProps) {
  const router = useRouter();
  const [profileForm, setProfileForm] = useState<ProfileFormState>(
    toProfileFormState(initialProfile)
  );
  const [familyProfiles, setFamilyProfiles] = useState(initialFamilyProfiles);
  const [familyForm, setFamilyForm] = useState<FamilyFormState>(EMPTY_FAMILY_FORM);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFamilyProfiles(initialFamilyProfiles);
  }, [initialFamilyProfiles]);

  async function saveProfile() {
    setSavingProfile(true);
    setMessage('');
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(data?.error ?? '프로필을 저장하지 못했습니다.');
        return;
      }
      setMessage('내 프로필을 저장했습니다. 오늘운세와 사주 시작하기에서 같은 입력값을 바로 불러옵니다.');
      router.refresh();
    } catch {
      setMessage('프로필 저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveFamilyProfile() {
    setSavingFamily(true);
    setMessage('');
    try {
      const response = await fetch('/api/family-profiles', {
        method: editingFamilyId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFamilyId ? { id: editingFamilyId, ...familyForm } : familyForm),
      });
      const data = (await response.json().catch(() => null)) as {
        id?: unknown;
        error?: string;
      } | null;
      if (!response.ok) {
        setMessage(data?.error ?? '가족 프로필을 저장하지 못했습니다.');
        return;
      }
      const savedId = typeof data?.id === 'string' ? data.id : editingFamilyId;
      if (!savedId) {
        setMessage('가족 프로필은 저장됐지만 화면 갱신 정보가 부족합니다. 잠시 후 다시 확인해 주세요.');
        router.refresh();
        return;
      }
      const existingCreatedAt =
        familyProfiles.find((profile) => profile.id === savedId)?.createdAt ??
        new Date().toISOString();
      const savedProfile = toFamilyProfileFromForm(savedId, familyForm, existingCreatedAt);
      setFamilyProfiles((current) =>
        editingFamilyId
          ? current.map((profile) => (profile.id === savedId ? savedProfile : profile))
          : [savedProfile, ...current]
      );
      setFamilyForm(EMPTY_FAMILY_FORM);
      setEditingFamilyId(null);
      setMessage(
        editingFamilyId
          ? '가족 프로필을 수정했습니다. 사주 시작하기와 궁합 입력에서도 같은 값으로 불러옵니다.'
          : '가족 프로필을 추가했습니다. 궁합 입력에서 이름만 눌러 바로 채울 수 있습니다.'
      );
      router.refresh();
    } catch {
      setMessage('가족 프로필 저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSavingFamily(false);
    }
  }

  function editFamilyProfile(profile: FamilyProfile) {
    setEditingFamilyId(profile.id);
    setFamilyForm(toFamilyFormState(profile));
    setMessage(`${profile.label} 프로필을 수정 중입니다. 저장하면 기존 정보가 바뀝니다.`);
  }

  function cancelFamilyEdit() {
    setEditingFamilyId(null);
    setFamilyForm(EMPTY_FAMILY_FORM);
    setMessage('');
  }

  async function removeFamilyProfile(id: string) {
    setDeletingId(id);
    setMessage('');
    try {
      const response = await fetch('/api/family-profiles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setMessage(data?.error ?? '가족 프로필을 삭제하지 못했습니다.');
        return;
      }
      if (editingFamilyId === id) {
        setEditingFamilyId(null);
        setFamilyForm(EMPTY_FAMILY_FORM);
      }
      const nextCount = Math.max(0, familyProfiles.length - 1);
      setFamilyProfiles((current) => current.filter((profile) => profile.id !== id));
      setMessage(`가족 프로필을 삭제했습니다. 현재 ${nextCount}명을 보관 중입니다.`);
      router.refresh();
    } catch {
      setMessage('가족 프로필 삭제 중 네트워크 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="app-panel p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="app-caption">내 기본 정보</div>
            <h2 className="mt-2 text-2xl text-[var(--app-ivory)]">
              오늘운세와 사주 시작하기가 이 정보를 같이 씁니다
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--app-copy-muted)]">
              여기서 저장한 양력·음력, 태어난 시간, 출생지, 시각 규칙은 `/today-fortune`과 `/saju/new`에서 같은 방식으로 다시 불러옵니다.
            </p>
          </div>
          <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
            공통 입력 기본값
          </Badge>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-[var(--app-copy)]">이름 또는 별칭</label>
              <Input
                value={profileForm.displayName}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="예: 민지"
                className="moon-form-control h-12 px-3 text-sm"
              />
            </div>

            <ManagedBirthFields
              draft={profileForm}
              onChange={(patch) => setProfileForm((current) => ({ ...current, ...patch }))}
              helperText="시간을 모르셔도 저장할 수 있고, 양력·음력 구분과 출생지는 그대로 보관됩니다. 진태양시를 쓰고 싶으면 출생지를 함께 넣어 두는 편이 좋습니다."
              dateInputVariant="select"
            />

            <div>
              <label className="mb-2 block text-sm text-[var(--app-copy)]">메모</label>
              <textarea
                value={profileForm.note}
                onChange={(event) =>
                  setProfileForm((current) => ({ ...current, note: event.target.value }))
                }
                rows={4}
                placeholder="예: 태어난 시간은 오전으로만 기억남"
                className="moon-form-control min-h-28 px-3 py-3 text-sm leading-7"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
              <div className="app-caption">현재 저장값</div>
              <h3 className="mt-2 text-xl font-semibold text-[var(--app-ivory)]">
                {profileForm.displayName.trim() || '이름 미입력'}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
                {formatBirthSummary({
                  calendarType: profileForm.calendarType,
                  timeRule: profileForm.timeRule,
                  birthYear: profileForm.year ? Number(profileForm.year) : null,
                  birthMonth: profileForm.month ? Number(profileForm.month) : null,
                  birthDay: profileForm.day ? Number(profileForm.day) : null,
                  birthHour: profileForm.unknownBirthTime || !profileForm.hour ? null : Number(profileForm.hour),
                  birthMinute:
                    profileForm.unknownBirthTime || !profileForm.hour || !profileForm.minute
                      ? null
                      : Number(profileForm.minute),
                  birthLocationLabel: profileForm.birthLocationLabel || undefined,
                })}
              </p>
              <p className="mt-3 text-xs leading-6 text-[var(--app-copy-soft)]">
                저장 후에는 오늘의 운세와 사주 시작하기에서 매번 다시 선택하지 않고 바로 이어집니다.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
              <div className="app-caption">저장 효과</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                <p>양력·음력 구분을 남겨두면 가족이나 본인 기록을 다시 볼 때 달력이 뒤섞이지 않습니다.</p>
                <p>시간 모름으로 저장한 경우에는 시주 중심 해석을 줄이고, 일간과 월령 중심으로 읽습니다.</p>
                <p>출생지와 시각 규칙을 저장하면 진태양시가 필요한 경우에도 같은 기준을 계속 씁니다.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? '저장 중...' : '내 기본 정보 저장'}
          </Button>
          <p className="text-sm text-[var(--app-copy-muted)]">
            저장하면 기존 MY 프로필 값이 이 기준으로 업데이트됩니다.
          </p>
        </div>
      </section>

      <section className="app-panel p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="app-caption">가족 보관함</div>
            <h2 className="mt-2 text-2xl text-[var(--app-ivory)]">
              가족, 연인, 친구의 기준 정보도 같은 방식으로 저장합니다
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--app-copy-muted)]">
              가족 프로필도 양력·음력, 시간 모름, 출생지, 시각 규칙을 함께 저장해두면 궁합과 비교 해석에서 입력을 다시 반복하지 않아도 됩니다.
            </p>
          </div>
          <Badge className="border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 text-[var(--app-jade)]">
            {editingFamilyId ? '수정 중' : `가족 ${familyProfiles.length}명`}
          </Badge>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-3">
            {familyProfiles.length > 0 ? (
              familyProfiles.map((profile) => (
                <article
                  key={profile.id}
                  className="rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--app-ivory)]">
                        {profile.label} · {profile.relationship}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">
                        {formatBirthSummary(profile)}
                        {profile.gender ? ` · ${profile.gender === 'male' ? '남성' : '여성'}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        onClick={() => editFamilyProfile(profile)}
                        disabled={savingFamily || deletingId === profile.id}
                        variant="outline"
                        size="sm"
                      >
                        수정
                      </Button>
                      <Button
                        onClick={() => removeFamilyProfile(profile.id)}
                        disabled={deletingId === profile.id}
                        variant="destructive"
                        size="sm"
                      >
                        {deletingId === profile.id ? '삭제 중...' : '삭제'}
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-6 text-sm leading-7 text-[var(--app-copy-muted)]">
                아직 가족 프로필이 없습니다. 배우자, 부모, 자녀, 친구처럼 자주 보는 분부터 저장해두면 이후 궁합과 가족 리포트로 곧바로 이어집니다.
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-[var(--app-copy)]">이름 또는 별칭</label>
                <Input
                  value={familyForm.label}
                  onChange={(event) =>
                    setFamilyForm((current) => ({ ...current, label: event.target.value }))
                  }
                  placeholder="이름 또는 별칭"
                  className="moon-form-control h-12 px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-[var(--app-copy)]">관계</label>
                <select
                  value={familyForm.relationship}
                  onChange={(event) =>
                    setFamilyForm((current) => ({ ...current, relationship: event.target.value }))
                  }
                  className="moon-form-control h-12 px-3 text-sm"
                >
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option} value={option} className="bg-slate-950">
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ManagedBirthFields
              draft={familyForm}
              onChange={(patch) => setFamilyForm((current) => ({ ...current, ...patch }))}
              dateInputVariant="select"
              helperText="가족 프로필도 오늘운세와 사주 시작하기와 같은 입력 규칙으로 저장됩니다. 음력 생일만 기억하는 경우에도 그대로 남겨둘 수 있습니다."
            />

            <div>
              <label className="mb-2 block text-sm text-[var(--app-copy)]">메모</label>
              <textarea
                value={familyForm.note}
                onChange={(event) =>
                  setFamilyForm((current) => ({ ...current, note: event.target.value }))
                }
                rows={4}
                placeholder="예: 엄마, 음력 생일만 기억남"
                className="moon-form-control min-h-28 px-3 py-3 text-sm leading-7"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={saveFamilyProfile}
                disabled={savingFamily}
              >
                {savingFamily
                  ? editingFamilyId
                    ? '수정 중...'
                    : '추가 중...'
                  : editingFamilyId
                    ? '가족 정보 수정 저장'
                    : '가족 정보 추가'}
              </Button>
              {editingFamilyId ? (
                <Button
                  onClick={cancelFamilyEdit}
                  disabled={savingFamily}
                  variant="secondary"
                >
                  수정 취소
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {message ? <p className="mt-5 text-sm text-[var(--app-gold-text)]">{message}</p> : null}
      </section>
    </div>
  );
}
