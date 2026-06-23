// Redesign 2026-05-13: PR5 사주 입력 birth step 의 mockup 스타일을 공통 컴포넌트로 추출.
// 오늘운세 / MY 프로필 / 궁합 입력에서 모두 같은 시각으로 동작.
// 라우팅·검증은 호출 측 책임 — 본 컴포넌트는 순수 폼 UI만 담당.
'use client';

import { useRef, type Dispatch, type SetStateAction } from 'react';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import type {
  UnifiedBirthEntryDraft,
  UnifiedCalendarType,
} from '@/lib/saju/unified-birth-entry';
import type { BirthLocationSearchResultLike } from '@/components/saju/shared/unified-birth-info-fields';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import { cn } from '@/lib/utils';
// 2026-05-15 handoff PR-G2: 61 m-input — motion-input-effect CSS 로딩.
import '@/components/motion/motion-primitives.css';

// 시(時) → 12지 + 시진명 + 시간대
const HOUR_BRANCHES: ReadonlyArray<{
  zodiac: ZodiacKey;
  label: string;
  range: string;
  hours: readonly number[];
}> = [
  { zodiac: 'rat', label: '자시', range: '23:00 — 01:00', hours: [23, 0] },
  { zodiac: 'ox', label: '축시', range: '01:00 — 03:00', hours: [1, 2] },
  { zodiac: 'tiger', label: '인시', range: '03:00 — 05:00', hours: [3, 4] },
  { zodiac: 'rabbit', label: '묘시', range: '05:00 — 07:00', hours: [5, 6] },
  { zodiac: 'dragon', label: '진시', range: '07:00 — 09:00', hours: [7, 8] },
  { zodiac: 'snake', label: '사시', range: '09:00 — 11:00', hours: [9, 10] },
  { zodiac: 'horse', label: '오시', range: '11:00 — 13:00', hours: [11, 12] },
  { zodiac: 'sheep', label: '미시', range: '13:00 — 15:00', hours: [13, 14] },
  { zodiac: 'monkey', label: '신시', range: '15:00 — 17:00', hours: [15, 16] },
  { zodiac: 'rooster', label: '유시', range: '17:00 — 19:00', hours: [17, 18] },
  { zodiac: 'dog', label: '술시', range: '19:00 — 21:00', hours: [19, 20] },
  { zodiac: 'pig', label: '해시', range: '21:00 — 23:00', hours: [21, 22] },
] as const;

function getHourBranch(hourStr: string) {
  if (!hourStr) return null;
  const hour = Number.parseInt(hourStr, 10);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return HOUR_BRANCHES.find((b) => b.hours.includes(hour)) ?? null;
}

// 2026-05-15 handoff PR-G2: 61 m-input — input focus 시 ring + lift 모션.
// motion-input-effect 클래스가 box-shadow + transform 으로 강조.
const INPUT_CLS =
  'motion-input-effect h-12 w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3.5 text-[16.7px] font-semibold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]';

export interface CompactBirthFieldsProps {
  draft: UnifiedBirthEntryDraft;
  onChange: (patch: Partial<UnifiedBirthEntryDraft>) => void;
  onStarted?: () => void;

  /** 이름(별칭) 입력 노출 여부. nickname 값/setter 직접 받아옴 */
  nickname?: string;
  onNicknameChange?: Dispatch<SetStateAction<string>> | ((value: string) => void);

  /** 각 섹션 표시 토글 (기본 true) */
  showName?: boolean;
  showDate?: boolean;
  showTime?: boolean;
  showGender?: boolean;
  showLocation?: boolean;

  /** 출생지 선택 시 location preset/검색 */
  onLocationSearch?: () => void;
  onLocationPresetSelect?: (code: string) => void;
  onLocationResultSelect?: (result: BirthLocationSearchResultLike) => void;
  locationLoading?: boolean;
  locationMessage?: string;
  locationResults?: BirthLocationSearchResultLike[];

  /** 추가 className (외부 wrapper 스페이싱 제어) */
  className?: string;
}

function triggerStart(onStarted?: () => void) {
  onStarted?.();
}

export function CompactBirthFields({
  draft,
  onChange,
  onStarted,
  nickname = '',
  onNicknameChange,
  showName = false,
  showDate = true,
  showTime = true,
  showGender = true,
  showLocation = false,
  onLocationSearch,
  onLocationPresetSelect,
  onLocationResultSelect,
  locationLoading,
  locationMessage,
  locationResults,
  className,
}: CompactBirthFieldsProps) {
  const hourBranch = getHourBranch(draft.hour);
  const isHourUnknown = draft.hour === '';
  // 생년월일 자동 포커스 이동 — 연도 4자리 입력 완료 시 월, 월 2자리 완료 시 일 칸으로.
  const monthInputRef = useRef<HTMLInputElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('space-y-4 sm:space-y-5', className)}>
      {showName ? (
        <div>
          <label
            htmlFor="compact-nickname"
            className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]"
          >
            이름 (별칭)
          </label>
          <input
            id="compact-nickname"
            type="text"
            value={nickname}
            onChange={(event) => {
              triggerStart(onStarted);
              onNicknameChange?.(event.target.value);
            }}
            placeholder="달빛이"
            autoComplete="name"
            className={cn('mt-1.5', INPUT_CLS)}
          />
        </div>
      ) : null}

      {showDate ? (
        <div>
          <label className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]">
            생년월일
          </label>
          <div className="mt-1.5 grid grid-cols-[1.2fr_1fr_1fr] gap-2">
            <input
              value={draft.year}
              onChange={(event) => {
                triggerStart(onStarted);
                const value = event.target.value;
                onChange({ year: value });
                if (value.length === 4) monthInputRef.current?.focus();
              }}
              placeholder="1995"
              inputMode="numeric"
              maxLength={4}
              aria-label="출생 연도"
              className={cn('text-center', INPUT_CLS)}
            />
            <input
              ref={monthInputRef}
              value={draft.month}
              onChange={(event) => {
                triggerStart(onStarted);
                const value = event.target.value;
                onChange({ month: value });
                if (value.length === 2) dayInputRef.current?.focus();
              }}
              placeholder="08"
              inputMode="numeric"
              maxLength={2}
              aria-label="출생 월"
              className={cn('text-center', INPUT_CLS)}
            />
            <input
              ref={dayInputRef}
              value={draft.day}
              onChange={(event) => {
                triggerStart(onStarted);
                onChange({ day: event.target.value });
              }}
              placeholder="14"
              inputMode="numeric"
              maxLength={2}
              aria-label="출생 일"
              className={cn('text-center', INPUT_CLS)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { v: 'solar', l: '양력' },
              { v: 'lunar', l: '음력' },
            ].map((opt) => {
              const active = draft.calendarType === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => {
                    triggerStart(onStarted);
                    onChange({ calendarType: opt.v as UnifiedCalendarType });
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[13.8px] font-bold transition',
                    active
                      ? 'border-transparent bg-[var(--app-pink)] text-white'
                      : 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]'
                  )}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showTime ? (
        <div>
          <label className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]">
            태어난 시각
          </label>
          <div
            className="relative mt-1.5 flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] p-3.5"
            style={{ background: 'var(--app-pink-soft)' }}
          >
            {hourBranch ? (
              <>
                <ZodiacChip kind={hourBranch.zodiac} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[16.1px] font-bold text-[var(--app-ink)]">
                    {Number.parseInt(draft.hour, 10)}시 ({hourBranch.label})
                  </div>
                  <div className="mt-0.5 text-[13.2px] text-[var(--app-copy-soft)]">
                    {hourBranch.range}
                  </div>
                </div>
                <span className="text-[16.1px] font-extrabold text-[var(--app-pink-strong)]">
                  변경
                </span>
              </>
            ) : (
              <>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[var(--app-line)] bg-white text-[20.7px] font-bold text-[var(--app-copy-muted)]"
                  aria-hidden="true"
                >
                  ?
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[16.1px] font-bold text-[var(--app-ink)]">시간 모름</div>
                  <div className="mt-0.5 text-[13.2px] text-[var(--app-copy-soft)]">
                    탭하여 출생 시간을 선택하세요
                  </div>
                </div>
                <span className="text-[16.1px] font-extrabold text-[var(--app-pink-strong)]">
                  변경
                </span>
              </>
            )}
            <select
              value={draft.hour}
              onChange={(event) => {
                triggerStart(onStarted);
                onChange({
                  hour: event.target.value,
                  unknownBirthTime: event.target.value === '',
                });
              }}
              aria-label="태어난 시간 선택"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">시간 모름</option>
              {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                <option key={h} value={String(h)}>
                  {String(h).padStart(2, '0')}시
                </option>
              ))}
            </select>
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[15px] text-[var(--app-copy-muted)]">
            <input
              type="checkbox"
              checked={isHourUnknown}
              onChange={(event) => {
                triggerStart(onStarted);
                onChange({
                  unknownBirthTime: event.target.checked,
                  hour: event.target.checked ? '' : draft.hour,
                  minute: event.target.checked ? '' : draft.minute,
                });
              }}
              className="h-4 w-4 rounded border-[var(--app-line)] accent-[var(--app-pink)]"
            />
            태어난 시간을 정확히 모르겠어요
          </label>
        </div>
      ) : null}

      {showGender ? (
        <div>
          <label className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]">
            성별
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {[
              { v: 'female', l: '여성' },
              { v: 'male', l: '남성' },
            ].map((opt) => {
              const active = draft.gender === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => {
                    triggerStart(onStarted);
                    onChange({ gender: opt.v as 'female' | 'male' });
                  }}
                  className={cn(
                    'h-12 rounded-[14px] border text-[16.7px] font-bold transition',
                    active
                      ? 'border-[var(--app-pink)] bg-[var(--app-pink)] text-white'
                      : 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]'
                  )}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showLocation ? (
        <div>
          <label
            htmlFor="compact-birth-location"
            className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]"
          >
            출생지
          </label>
          <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
            <input
              id="compact-birth-location"
              type="text"
              value={draft.birthLocationLabel}
              onChange={(event) => {
                triggerStart(onStarted);
                onChange({
                  birthLocationCode: draft.birthLocationCode || 'custom',
                  birthLocationLabel: event.target.value,
                });
              }}
              placeholder="서울, 부산, 수원처럼 입력"
              autoComplete="off"
              className={INPUT_CLS}
            />
            {onLocationSearch ? (
              <button
                type="button"
                onClick={onLocationSearch}
                disabled={locationLoading}
                className="h-12 shrink-0 rounded-[12px] border border-[var(--app-pink-line)] bg-white px-3 text-[14.4px] font-bold text-[var(--app-pink-strong)] transition hover:bg-[var(--app-pink-soft)] disabled:opacity-60"
              >
                {locationLoading ? '검색 중' : '주소 검색'}
              </button>
            ) : null}
          </div>
          {locationMessage ? (
            <p className="mt-1.5 text-[13.2px] text-[var(--app-copy-soft)]">{locationMessage}</p>
          ) : null}
          {locationResults && locationResults.length > 0 ? (
            <ul className="mt-2 grid gap-1.5">
              {locationResults.slice(0, 4).map((item) => (
                <li key={`${item.label}-${item.latitude}-${item.longitude}`}>
                  <button
                    type="button"
                    onClick={() => onLocationResultSelect?.(item)}
                    className="block w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3 py-2.5 text-left text-[15px] font-medium text-[var(--app-ink)] transition hover:border-[var(--app-pink-line)] hover:bg-[var(--app-pink-soft)]"
                  >
                    {item.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {onLocationPresetSelect ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BIRTH_LOCATION_PRESETS.slice(0, 6).map((preset) => {
                const active = draft.birthLocationCode === preset.code;
                return (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => onLocationPresetSelect(preset.code)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[13.2px] font-bold transition',
                      active
                        ? 'border-transparent bg-[var(--app-pink)] text-white'
                        : 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]'
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
