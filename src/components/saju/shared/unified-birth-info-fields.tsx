'use client';

import { useMemo, useRef } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HOUR_OPTIONS } from '@/features/home/content';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import type {
  UnifiedBirthEntryDraft,
  UnifiedCalendarType,
  UnifiedTimeRule,
} from '@/lib/saju/unified-birth-entry';
import { cn } from '@/lib/utils';

export interface BirthLocationSearchResultLike {
  id: string;
  label: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

export type UnifiedBirthInfoSection = 'date' | 'gender' | 'location-time';

const TIME_RULE_OPTIONS: Array<{
  value: UnifiedTimeRule;
  label: string;
  desc: string;
}> = [
  { value: 'standard', label: '표준시', desc: '기본 한국 표준시 적용' },
  { value: 'trueSolarTime', label: '진태양시', desc: '출생지 경도 보정 반영' },
  { value: 'nightZi', label: '야자시', desc: '자시를 한 흐름으로 묶어 봄' },
  { value: 'earlyZi', label: '조자시', desc: '자시 경계를 더 엄격하게 분리' },
];

interface UnifiedBirthInfoFieldsProps {
  draft: UnifiedBirthEntryDraft;
  onChange: (patch: Partial<UnifiedBirthEntryDraft>) => void;
  onStarted?: () => void;
  idPrefix?: string;
  dateInputVariant?: 'input' | 'select';
  visibleSections?: readonly UnifiedBirthInfoSection[];
  /** location-time 섹션에서 시간 picker 만 숨기고 location picker 만 보이게. PR5 사주입력 redesign 용. */
  hideTimePicker?: boolean;
  locationLoading: boolean;
  locationMessage: string;
  locationResults: BirthLocationSearchResultLike[];
  onLocationSearch: () => void;
  onPresetSelect: (code: string) => void;
  onLocationResultSelect: (result: BirthLocationSearchResultLike) => void;
}

function trigger(onStarted?: () => void) {
  onStarted?.();
}

const YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) =>
  String(new Date().getFullYear() - index)
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));

function getDaysInMonth(yearValue: string, monthValue: string) {
  const parsedMonth = Number.parseInt(monthValue, 10);

  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return 31;
  }

  const parsedYear = Number.parseInt(yearValue, 10);
  const safeYear = Number.isInteger(parsedYear) && parsedYear >= 1900 ? parsedYear : 2000;

  return new Date(safeYear, parsedMonth, 0).getDate();
}

export function UnifiedBirthInfoFields({
  draft,
  onChange,
  onStarted,
  idPrefix = 'unified',
  dateInputVariant = 'select',
  visibleSections,
  hideTimePicker = false,
  locationLoading,
  locationMessage,
  locationResults,
  onLocationSearch,
  onPresetSelect,
  onLocationResultSelect,
}: UnifiedBirthInfoFieldsProps) {
  const dayOptions = useMemo(
    () =>
      Array.from({ length: getDaysInMonth(draft.year, draft.month) }, (_, index) => String(index + 1)),
    [draft.month, draft.year]
  );
  // 생년월일 자동 포커스 이동 — 연도 선택 시 월, 월 선택 시 일 칸으로(select 드롭다운).
  const monthSelectRef = useRef<HTMLSelectElement>(null);
  const daySelectRef = useRef<HTMLSelectElement>(null);
  const sections = visibleSections ?? ['date', 'gender', 'location-time'];
  const showDate = sections.includes('date');
  const showGender = sections.includes('gender');
  const showLocationTime = sections.includes('location-time');
  const timeRuleDisabled = draft.unknownBirthTime;
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  function applyDateSelectPatch(
    patch: Partial<UnifiedBirthEntryDraft> & Pick<UnifiedBirthEntryDraft, 'year' | 'month' | 'day'>
  ) {
    const nextDraft = { ...draft, ...patch };
    const nextDay = Number.parseInt(nextDraft.day, 10);
    const nextMaxDay = getDaysInMonth(nextDraft.year, nextDraft.month);

    if (Number.isInteger(nextDay) && nextDay > nextMaxDay) {
      onChange({ ...patch, day: '' });
      return;
    }

    onChange(patch);
  }

  return (
    <div
      className={cn(
        'unified-birth-form grid gap-4 sm:gap-5',
        sections.length === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2'
      )}
    >
      {showDate || showGender ? (
        <div className="space-y-4">
          {showDate ? (
            <>
              <div className="gangi-birth-field">
                <Label className="gangi-birth-label">양력 / 음력</Label>
                <div className="gangi-birth-segment">
                  {[
                    { value: 'solar', label: '양력' },
                    { value: 'lunar', label: '음력' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        trigger(onStarted);
                        onChange({ calendarType: item.value as UnifiedCalendarType });
                      }}
                      className={cn('gangi-birth-choice', draft.calendarType === item.value && 'is-selected')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gangi-birth-date-grid">
                <div className="gangi-birth-field">
                  <Label htmlFor={fieldId('birth-year')} className="gangi-birth-label">
                    년
                  </Label>
                  {dateInputVariant === 'select' ? (
                    <select
                      id={fieldId('birth-year')}
                      name="moonlight-birth-year"
                      value={draft.year}
                      onChange={(event) => {
                        trigger(onStarted);
                        const value = event.target.value;
                        applyDateSelectPatch({ year: value, month: draft.month, day: draft.day });
                        if (value) monthSelectRef.current?.focus();
                      }}
                      className="gangi-form-control gangi-birth-input px-3 text-sm"
                    >
                      <option value="">연도 선택</option>
                      {YEAR_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value}년
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={fieldId('birth-year')}
                      name="moonlight-birth-year"
                      value={draft.year}
                      onChange={(event) => {
                        trigger(onStarted);
                        onChange({ year: event.target.value });
                      }}
                      placeholder="1982"
                      autoComplete="off"
                      inputMode="numeric"
                      className="gangi-form-control gangi-birth-input px-3 text-sm"
                    />
                  )}
                </div>
                <div className="gangi-birth-field">
                  <Label htmlFor={fieldId('birth-month')} className="gangi-birth-label">
                    월
                  </Label>
                  {dateInputVariant === 'select' ? (
                    <select
                      ref={monthSelectRef}
                      id={fieldId('birth-month')}
                      name="moonlight-birth-month"
                      value={draft.month}
                      onChange={(event) => {
                        trigger(onStarted);
                        const value = event.target.value;
                        applyDateSelectPatch({ year: draft.year, month: value, day: draft.day });
                        if (value) daySelectRef.current?.focus();
                      }}
                      className="gangi-form-control gangi-birth-input px-3 text-sm"
                    >
                      <option value="">월 선택</option>
                      {MONTH_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value}월
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={fieldId('birth-month')}
                      name="moonlight-birth-month"
                      value={draft.month}
                      onChange={(event) => {
                        trigger(onStarted);
                        onChange({ month: event.target.value });
                      }}
                      placeholder="1"
                      autoComplete="off"
                      inputMode="numeric"
                      className="gangi-form-control gangi-birth-input px-3 text-sm"
                    />
                  )}
                </div>
                <div className="gangi-birth-field">
                  <Label htmlFor={fieldId('birth-day')} className="gangi-birth-label">
                    일
                  </Label>
                  {dateInputVariant === 'select' ? (
                    <select
                      ref={daySelectRef}
                      id={fieldId('birth-day')}
                      name="moonlight-birth-day"
                      value={draft.day}
                      onChange={(event) => {
                        trigger(onStarted);
                        onChange({ day: event.target.value });
                      }}
                      className="gangi-form-control gangi-birth-input px-3 text-sm"
                    >
                      <option value="">일 선택</option>
                      {dayOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}일
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={fieldId('birth-day')}
                      name="moonlight-birth-day"
                      value={draft.day}
                      onChange={(event) => {
                        trigger(onStarted);
                        onChange({ day: event.target.value });
                      }}
                      placeholder="29"
                      autoComplete="off"
                      inputMode="numeric"
                      className="gangi-form-control gangi-birth-input px-3 text-sm"
                    />
                  )}
                </div>
              </div>
            </>
          ) : null}

          {showGender ? (
            <div className="gangi-birth-field">
              <Label className="gangi-birth-label">성별</Label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[
                  { value: 'female', label: '여성' },
                  { value: 'male', label: '남성' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      trigger(onStarted);
                      onChange({ gender: item.value });
                    }}
                    className={cn('gangi-birth-card-choice', draft.gender === item.value && 'is-selected')}
                  >
                    <span className="block text-base font-bold text-[var(--app-ink)] sm:text-lg">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showLocationTime ? (
        <div className="space-y-4">
          {hideTimePicker ? null : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="gangi-birth-field">
              <Label htmlFor={fieldId('birth-hour')} className="gangi-birth-label">
                태어난 시간
              </Label>
              <select
                id={fieldId('birth-hour')}
                name="moonlight-birth-hour"
                value={draft.hour}
                onChange={(event) => {
                  trigger(onStarted);
                  onChange({
                    hour: event.target.value,
                    unknownBirthTime: event.target.value === '',
                  });
                }}
                className="gangi-form-control gangi-birth-input px-3 text-sm"
              >
                {HOUR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="gangi-birth-field">
              <Label htmlFor={fieldId('birth-minute')} className="gangi-birth-label">
                분
              </Label>
              <Input
                id={fieldId('birth-minute')}
                name="moonlight-birth-minute"
                value={draft.minute}
                onChange={(event) => {
                  trigger(onStarted);
                  onChange({ minute: event.target.value });
                }}
                disabled={draft.unknownBirthTime}
                placeholder="45"
                autoComplete="off"
                inputMode="numeric"
                className="gangi-form-control gangi-birth-input px-3 text-sm"
              />
            </div>
            <label className="gangi-birth-unknown sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.unknownBirthTime}
                onChange={(event) => {
                  trigger(onStarted);
                  onChange({
                    unknownBirthTime: event.target.checked,
                    hour: event.target.checked ? '' : draft.hour,
                    minute: event.target.checked ? '' : draft.minute,
                  });
                }}
                className="h-4 w-4 rounded border-[var(--app-line)] accent-[var(--app-pink)]"
              />
              태어난 시간을 잘 모르겠어요
            </label>
          </div>
          )}

          <div className="gangi-birth-field">
            <Label htmlFor={fieldId('birth-location')} className="gangi-birth-label">
              출생지
            </Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                id={fieldId('birth-location')}
                name="moonlight-birth-location"
                value={draft.birthLocationLabel}
                onChange={(event) => {
                  trigger(onStarted);
                  onChange({
                    birthLocationCode: draft.birthLocationCode || 'custom',
                    birthLocationLabel: event.target.value,
                  });
                }}
                placeholder="서울, 부산, 수원처럼 입력"
                autoComplete="off"
                className="gangi-form-control gangi-birth-input px-3 text-sm"
              />
              <Button
                type="button"
                onClick={onLocationSearch}
                disabled={locationLoading}
                variant="outline"
                className="gangi-birth-search-button"
              >
                <Search className="mr-2 h-4 w-4" />
                {locationLoading ? '검색 중...' : '좌표 찾기'}
              </Button>
            </div>
            {locationMessage ? (
              <p className="mt-2 text-xs leading-6 text-[var(--app-copy-soft)]">{locationMessage}</p>
            ) : null}
          </div>

          <div className="gangi-birth-location-presets">
            {BIRTH_LOCATION_PRESETS.map((preset) => (
              <button
                key={preset.code}
                type="button"
                onClick={() => {
                  trigger(onStarted);
                  onPresetSelect(preset.code);
                }}
                className={cn('gangi-birth-chip', draft.birthLocationCode === preset.code && 'is-selected')}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {locationResults.length > 0 ? (
            <div className="space-y-2">
              {locationResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    trigger(onStarted);
                    onLocationResultSelect(item);
                  }}
                  className="block w-full rounded-[1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-left text-sm text-[var(--app-copy)] transition-colors hover:border-[var(--app-pink)]/28 hover:text-[var(--app-ink)]"
                >
                  <div className="font-medium text-[var(--app-ink)]">{item.label}</div>
                  <div className="mt-1 text-xs leading-6 text-[var(--app-copy-soft)]">
                    {item.displayName} · 위도 {item.latitude} · 경도 {item.longitude}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {hideTimePicker ? null : (
            <div className="gangi-birth-field">
              <Label htmlFor={fieldId('time-rule')} className="gangi-birth-label">
                시간 적용
              </Label>
              <select
                id={fieldId('time-rule')}
                name="moonlight-time-rule"
                value={draft.timeRule}
                onChange={(event) => {
                  trigger(onStarted);
                  onChange({ timeRule: event.target.value as UnifiedTimeRule });
                }}
                disabled={timeRuleDisabled}
                className="gangi-form-control gangi-birth-input px-3 text-sm disabled:opacity-60"
              >
                {TIME_RULE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-6 text-[var(--app-copy-soft)]">
                {draft.timeRule === 'trueSolarTime'
                  ? '진태양시는 출생지 경도 정보가 있어야 실제로 반영됩니다.'
                  : '태어난 시간이 없으면 시주 중심 해석을 줄이고 일간·월령·현재 운 중심으로 읽습니다.'}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
