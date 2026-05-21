'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { BirthLocationSearchResultLike } from '@/components/saju/shared/unified-birth-info-fields';
import { CompactBirthFields } from '@/components/saju/shared/compact-birth-fields';
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
      // 2026-05-19 — 폼 UI 에서 분(minute) 입력 제거된 후로는 옛 profile.birthMinute 도
      //   사용하지 않음. 옛 시드 profile (birth_minute = N) 을 자동 채우면 새 reading 의
      //   BirthInput.minute = N 으로 저장되어, minute = null 인 기존 reading 과 다른 사주가
      //   산출됨. E2E saju.spec.ts:157 회귀의 진짜 source.
      //   buildBirthTimeCorrection / lunar-typescript 가 standard mode 에서도 minute 단위
      //   를 시각 계산에 그대로 반영하므로, profile 의 옛 minute 값을 그대로 흘리면
      //   "사주 페이지 (stored reading minute=null) ↔ 운세 페이지 (fresh reading minute=N)"
      //   점수 불일치 발생.
      minute: '',
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
        setProfileMessage('MY 프로필 확인 중 네트워크 오류가 있었습니다.');
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
          : '조건에 맞는 지역을 찾지 못했습니다. 시/군/구 이름을 조금 더 구체적으로 적어주세요.'
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
    <section className="rounded-[18px] border border-[var(--app-line)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            출생 정보
          </div>
          <h2 className="mt-1 text-[17px] font-extrabold leading-snug text-[var(--app-ink)]">
            생년월일과 출생 정보를 넣어 오늘 흐름을 좁혀보세요
          </h2>
        </div>
        <button
          type="button"
          onClick={handleLoadProfile}
          disabled={profileLoading}
          className="rounded-full border border-[var(--app-pink-line)] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--app-pink-strong)] transition disabled:opacity-60"
        >
          {profileLoading ? 'MY 프로필 확인 중' : 'MY 프로필 적용'}
        </button>
      </div>

      {profileMessage ? (
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--app-copy-soft)]">
          {profileMessage}
        </p>
      ) : null}

      <div className="mt-4">
        <CompactBirthFields
          draft={draft}
          onChange={onChange}
          onStarted={onStarted}
          showDate
          showTime
          showGender
          showLocation
          locationLoading={locationLoading}
          locationMessage={locationMessage}
          locationResults={locationResults}
          onLocationSearch={handleLocationSearch}
          onLocationPresetSelect={applyPresetLocation}
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

      <p className="mt-4 text-[12px] leading-[1.55] text-[var(--app-copy-soft)]">
        {hasBirthCore(draft)
          ? '입력이 준비되면 결과 화면으로 이동해 오늘 한 줄을 보여드려요.'
          : '오늘의 고민에 맞춰 무료 결과를 만들려면 기본 출생 정보가 필요합니다.'}
      </p>

      <Button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        size="lg"
        className="mt-3 h-12 w-full rounded-[14px] text-[15px] font-extrabold"
      >
        {loading ? '무료 결과 만드는 중...' : '무료 결과 보기'}
      </Button>

      {errorMessage ? (
        <div className="mt-3 rounded-[12px] border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--app-ink)]">
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
