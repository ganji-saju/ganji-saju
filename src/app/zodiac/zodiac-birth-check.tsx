'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveZodiacByBirth } from './actions';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, index) => CURRENT_YEAR - index);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function daysInMonth(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 31;
  }
  return new Date(year, month, 0).getDate();
}

export function ZodiacBirthCheck() {
  const [open, setOpen] = useState(false);
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');

  const dayOptions = Array.from(
    { length: daysInMonth(Number.parseInt(year, 10), Number.parseInt(month, 10)) },
    (_, index) => index + 1
  );
  const canSubmit = year !== '' && month !== '' && day !== '';

  function clampDay(nextYear: string, nextMonth: string) {
    const max = daysInMonth(Number.parseInt(nextYear, 10), Number.parseInt(nextMonth, 10));
    if (Number.parseInt(day, 10) > max) {
      setDay('');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex h-12 items-center justify-center rounded-full px-5 text-[13.5px] font-extrabold text-white"
        style={{ background: 'var(--app-pink)', boxShadow: '0 12px 28px rgba(216, 27, 114, 0.32)' }}
      >
        생년월일로 내 띠 확인
      </button>
    );
  }

  return (
    <form action={resolveZodiacByBirth} className="mx-auto mt-5 max-w-[22rem] space-y-3 text-left">
      <input type="hidden" name="calendarType" value={calendarType} />

      <div className="gangi-birth-segment">
        {[
          { value: 'solar', label: '양력' },
          { value: 'lunar', label: '음력' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setCalendarType(item.value as 'solar' | 'lunar')}
            className={cn('gangi-birth-choice', calendarType === item.value && 'is-selected')}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="gangi-birth-date-grid">
        <select
          aria-label="태어난 연도"
          name="year"
          value={year}
          onChange={(event) => {
            const next = event.target.value;
            setYear(next);
            clampDay(next, month);
          }}
          className="gangi-form-control gangi-birth-input px-3 text-sm"
        >
          <option value="">연도</option>
          {YEAR_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}년
            </option>
          ))}
        </select>
        <select
          aria-label="태어난 월"
          name="month"
          value={month}
          onChange={(event) => {
            const next = event.target.value;
            setMonth(next);
            clampDay(year, next);
          }}
          className="gangi-form-control gangi-birth-input px-3 text-sm"
        >
          <option value="">월</option>
          {MONTH_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}월
            </option>
          ))}
        </select>
        <select
          aria-label="태어난 일"
          name="day"
          value={day}
          onChange={(event) => setDay(event.target.value)}
          className="gangi-form-control gangi-birth-input px-3 text-sm"
        >
          <option value="">일</option>
          {dayOptions.map((value) => (
            <option key={value} value={value}>
              {value}일
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-[13.5px] font-extrabold text-white transition disabled:opacity-50"
        style={{ background: 'var(--app-pink)', boxShadow: '0 12px 28px rgba(216, 27, 114, 0.32)' }}
      >
        내 띠 보기 →
      </button>
      <p className="text-center text-[11.5px] leading-[1.6]" style={{ color: 'var(--app-copy-muted)' }}>
        생년월일만 입력하면 입춘 기준으로 띠를 찾아드려요.
      </p>
    </form>
  );
}
