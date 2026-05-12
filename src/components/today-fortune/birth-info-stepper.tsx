'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UnifiedBirthInfoFields, type BirthLocationSearchResultLike } from '@/components/saju/shared/unified-birth-info-fields';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';
import type { UnifiedCalendarType, UnifiedTimeRule } from '@/lib/saju/unified-birth-entry';

interface ProfileResponse {
  authenticated: boolean;
  profile: {
    displayName: string;
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
    calendarType: UnifiedCalendarType;
    timeRule: UnifiedTimeRule;
    gender: 'male' | 'female' | null;
  } | null;
}

type BirthLocationSearchResult = BirthLocationSearchResultLike;

interface BirthLocationSearchResponse {
  ok: boolean;
  error?: string;
  items?: BirthLocationSearchResult[];
}

interface BirthInfoStepperProps {
  draft: TodayFortuneBirthPayload;
  onChange: (patch: Partial<TodayFortuneBirthPayload>) => void;
  onStarted: () => void;
  onSubmit: () => void;
  loading: boolean;
  errorMessage: string | null;
}

function hasBirthCore(draft: TodayFortuneBirthPayload) {
  return Boolean(draft.year && draft.month && draft.day);
}

export function BirthInfoStepper({
  draft,
  onChange,
  onStarted,
  onSubmit,
  loading,
  errorMessage,
}: BirthInfoStepperProps) {
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationResults, setLocationResults] = useState<BirthLocationSearchResult[]>([]);
  const autoProfileAttemptedRef = useRef(false);

  function applyProfileBirthInfo(profile: NonNullable<ProfileResponse['profile']>, message: string) {
    onStarted();
    onChange({
      calendarType: profile.calendarType ?? 'solar',
      year: String(profile.birthYear ?? ''),
      month: String(profile.birthMonth ?? ''),
      day: String(profile.birthDay ?? ''),
      hour: profile.birthHour === null ? '' : String(profile.birthHour),
      minute: profile.birthMinute === null ? '' : String(profile.birthMinute),
      unknownBirthTime: profile.birthHour === null,
      birthLocationCode: profile.birthLocationCode ?? '',
      birthLocationLabel: profile.birthLocationLabel ?? '',
      birthLatitude: profile.birthLatitude === null ? '' : String(profile.birthLatitude),
      birthLongitude: profile.birthLongitude === null ? '' : String(profile.birthLongitude),
      gender: profile.gender ?? '',
      timeRule: profile.timeRule ?? draft.timeRule,
    });
    setProfileMessage(message);
  }

  async function loadProfile(options?: { silent?: boolean }) {
    const silent = options?.silent === true;
    if (!silent) {
      setProfileLoading(true);
      setProfileMessage('');
    }

    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as ProfileResponse | null;

      if (
        !response.ok ||
        !data?.authenticated ||
        !data.profile?.birthYear ||
        !data.profile.birthMonth ||
        !data.profile.birthDay
      ) {
        if (!silent) {
          setProfileMessage('MY 프로필에 저장된 출생 정보가 아직 충분하지 않습니다.');
        }
        return;
      }

      applyProfileBirthInfo(
        data.profile,
        silent
          ? '로그인된 MY 프로필의 출생 정보를 기본값으로 불러왔습니다.'
          : 'MY 프로필의 출생 정보를 불러왔습니다.'
      );
    } catch {
      if (!silent) {
        setProfileMessage('MY 프로필을 불러오는 중 네트워크 오류가 있었습니다.');
      }
    } finally {
      if (!silent) {
        setProfileLoading(false);
      }
    }
  }

  async function handleLoadProfile() {
    setProfileLoading(true);
    await loadProfile();
  }

  useEffect(() => {
    if (autoProfileAttemptedRef.current || hasBirthCore(draft)) return;
    autoProfileAttemptedRef.current = true;
    void loadProfile({ silent: true });
  }, [draft]);

  async function handleLocationSearch() {
    const query = draft.birthLocationLabel.trim();
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
          : '검색 결과가 없습니다. 시/군/구 이름을 조금 더 구체적으로 적어주세요.'
      );
    } catch {
      setLocationMessage('지역 좌표를 찾는 중 네트워크 오류가 있었습니다.');
    } finally {
      setLocationLoading(false);
    }
  }

  function applyPresetLocation(code: string) {
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
    onChange({
      birthLocationCode: code,
      birthLocationLabel: preset?.label ?? '',
      birthLatitude: preset ? String(preset.latitude) : '',
      birthLongitude: preset ? String(preset.longitude) : '',
      timeRule: draft.timeRule === 'trueSolarTime' ? 'trueSolarTime' : draft.timeRule,
    });
  }

  return (
    <section className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--gyeol-muted)]">
            02 출생 정보
          </div>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--gyeol-text)]">
            생년월일과 출생 정보를 넣어 오늘 흐름을 좁혀보세요
          </h2>
        </div>
        <Button
          type="button"
          onClick={handleLoadProfile}
          disabled={profileLoading}
          variant="outline"
        >
          {profileLoading ? '불러오는 중...' : 'MY 프로필 불러오기'}
        </Button>
      </div>

      {profileMessage ? (
        <p className="mt-3 text-sm text-[var(--gyeol-muted)]">{profileMessage}</p>
      ) : null}

      <div className="mt-6">
        <UnifiedBirthInfoFields
          draft={draft}
          onChange={onChange}
          onStarted={onStarted}
          locationLoading={locationLoading}
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
            setLocationMessage(`출생지로 ${item.displayName}를 적용했습니다.`);
          }}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-[var(--gyeol-muted)]">
          {hasBirthCore(draft)
            ? '입력이 준비되면 결과 화면으로 이동해 오늘 한 줄을 보여드려요.'
            : '오늘의 고민에 맞춰 무료 결과를 만들려면 기본 출생 정보가 필요합니다.'}
        </p>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          size="lg"
        >
          {loading ? '무료 결과 만드는 중...' : '무료 결과 보기'}
        </Button>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[1rem] border border-[var(--gyeol-danger-line)] bg-[var(--gyeol-danger-soft)] px-4 py-3 text-sm text-[var(--gyeol-text)]">
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
