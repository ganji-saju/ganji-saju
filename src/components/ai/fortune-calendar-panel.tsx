'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { FortuneCalendarMonthReport, FortuneCalendarTone } from '@/domain/saju/report';
// 2026-05-16 — 같은 slug+년월에 대해 이미 monthly-calendar 구매한 사용자가
//   다시 결제 link 를 보지 않도록 entitlement 확인.
import { useProductEntitlement } from '@/lib/payments/use-product-entitlement';

interface Props {
  slug: string;
  targetYear: number;
  hasLifetimeAccess: boolean;
}

interface FortuneCalendarResponse {
  ok: boolean;
  access: 'lifetime' | 'month_unlock' | 'product_unlock' | 'locked';
  targetYear: number;
  month: number;
  monthLabel: string;
  coinCost: number;
  hasLifetimeAccess: boolean;
  report: FortuneCalendarMonthReport | null;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const TONE_META: Record<
  FortuneCalendarTone,
  {
    label: string;
    description: string;
    cellClassName: string;
    badgeClassName: string;
    railClassName: string;
    icon: LucideIcon;
  }
> = {
  decision: {
    label: '결정일',
    description: '계약, 신청, 발표처럼 방향을 정하기 좋은 날',
    cellClassName: 'border-[var(--app-pink)]/55 bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)] shadow-[0_4px_12px_rgba(216,27,114,0.18)]',
    badgeClassName: 'border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]',
    railClassName: 'bg-[var(--app-pink)]',
    icon: Target,
  },
  good: {
    label: '좋은 날',
    description: '연락하고, 정리하고, 가볍게 진행해도 좋은 날',
    cellClassName: 'border-[rgba(45,135,88,0.28)] bg-[#e8f5ee] text-[var(--app-jade)]',
    badgeClassName: 'border-[rgba(45,135,88,0.28)] bg-[#e8f5ee] text-[var(--app-jade)]',
    railClassName: 'bg-[var(--app-jade)]',
    icon: CheckCircle2,
  },
  average: {
    label: '보통 날',
    description: '큰 결정보다 루틴과 확인을 쌓기 좋은 날',
    cellClassName: 'border-[var(--app-line)] bg-white text-[var(--app-copy)]',
    badgeClassName: 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]',
    railClassName: 'bg-[var(--app-line)]',
    icon: CircleDot,
  },
  caution: {
    label: '주의 날',
    description: '돈, 말, 확답은 한 번 더 확인하는 날',
    cellClassName: 'border-[rgba(198,69,69,0.28)] bg-[#fdecec] text-[var(--app-coral)]',
    badgeClassName: 'border-[rgba(198,69,69,0.28)] bg-[#fdecec] text-[var(--app-coral)]',
    railClassName: 'bg-[var(--app-coral)]',
    icon: AlertTriangle,
  },
};

function getInitialMonth(targetYear: number) {
  const now = new Date();
  const thisYear = now.getFullYear();
  return targetYear === thisYear ? now.getMonth() + 1 : 1;
}

function buildPlaceholderWeeks(year: number, month: number) {
  const totalDays = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const days = Array.from({ length: totalDays }, (_, index) => ({
    day: index + 1,
    weekday: new Date(year, month - 1, index + 1).getDay(),
  }));

  const weeks: Array<Array<{ day: number } | null>> = [];
  let cursor = 0;
  let first = true;

  while (cursor < days.length) {
    const week: Array<{ day: number } | null> = Array.from({ length: 7 }, () => null);

    if (first) {
      for (let slot = firstWeekday; slot < 7 && cursor < days.length; slot += 1) {
        week[slot] = { day: days[cursor]!.day };
        cursor += 1;
      }
      first = false;
    } else {
      for (let slot = 0; slot < 7 && cursor < days.length; slot += 1) {
        week[slot] = { day: days[cursor]!.day };
        cursor += 1;
      }
    }

    weeks.push(week);
  }

  return weeks;
}

function MonthChip({
  month,
  active,
  onClick,
}: {
  month: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-extrabold transition-all"
      style={{
        background: active ? 'var(--app-pink)' : '#fff',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: active ? 'var(--app-pink)' : 'var(--app-line)',
        color: active ? '#fff' : 'var(--app-copy-muted)',
        boxShadow: active ? '0 6px 14px rgba(216,27,114,0.28)' : undefined,
      }}
    >
      {month}월
    </button>
  );
}

function isFortuneCalendarEntry(
  cell: FortuneCalendarMonthReport['days'][number] | { day: number }
): cell is FortuneCalendarMonthReport['days'][number] {
  return 'tone' in cell;
}

function formatDayLabel(entry: FortuneCalendarMonthReport['days'][number]) {
  const year = Number(entry.isoDate.slice(0, 4));
  const month = Number(entry.isoDate.slice(5, 7));
  return `${year}.${String(month).padStart(2, '0')}.${String(entry.day).padStart(2, '0')}`;
}

function formatCompactDay(entry: FortuneCalendarMonthReport['days'][number]) {
  return `${entry.day}일`;
}

function pickToneEntries(
  report: FortuneCalendarMonthReport,
  tones: FortuneCalendarTone[],
  limit: number,
  direction: 'high' | 'low'
) {
  return [...report.days]
    .filter((entry) => tones.includes(entry.tone))
    .sort((left, right) => (direction === 'high' ? right.score - left.score : left.score - right.score))
    .slice(0, limit);
}

function pickDefaultFocusDay(report: FortuneCalendarMonthReport | null | undefined) {
  if (!report) return null;
  return (
    pickToneEntries(report, ['decision'], 1, 'high')[0] ??
    pickToneEntries(report, ['good'], 1, 'high')[0] ??
    pickToneEntries(report, ['caution'], 1, 'low')[0] ??
    report.days[0] ??
    null
  );
}

function ToneSummaryCard({
  tone,
  count,
  entries,
  onSelect,
}: {
  tone: FortuneCalendarTone;
  count: number;
  entries: FortuneCalendarMonthReport['days'];
  onSelect: (day: number) => void;
}) {
  const meta = TONE_META[tone];
  const Icon = meta.icon;

  return (
    <div
      className="rounded-[14px] border bg-white p-3.5"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${meta.badgeClassName}`}>
          <Icon className="h-[14px] w-[14px]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12.5px] font-extrabold text-[var(--app-ink)]">{meta.label}</div>
            <div className="text-[15px] font-extrabold text-[var(--app-pink-strong)]">{count}일</div>
          </div>
          <p
            className="mt-1 text-[11px] leading-[1.55] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {meta.description}
          </p>
        </div>
      </div>
      {entries.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <button
              key={`${tone}-${entry.isoDate}`}
              type="button"
              onClick={() => onSelect(entry.day)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold transition-transform active:scale-95 ${meta.badgeClassName}`}
            >
              {formatCompactDay(entry)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CalendarMonthMap({
  report,
  onSelectDay,
}: {
  report: FortuneCalendarMonthReport;
  onSelectDay: (day: number) => void;
}) {
  const total = Math.max(1, report.totalDays);

  return (
    <div
      className="rounded-[16px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            월간 지도
          </div>
          <div className="mt-1 text-[13.5px] font-extrabold text-[var(--app-ink)]">
            먼저 볼 날을 색으로 나눴습니다
          </div>
        </div>
        <CalendarDays className="h-4 w-4 text-[var(--app-pink-strong)]" aria-hidden="true" />
      </div>

      <div
        className="mt-3 overflow-hidden rounded-full border"
        style={{ borderColor: 'var(--app-line)', background: 'rgba(0,0,0,0.04)' }}
      >
        <div className="flex h-2.5">
          {(['decision', 'good', 'average', 'caution'] as FortuneCalendarTone[]).map((tone) => (
            <div
              key={tone}
              className={TONE_META[tone].railClassName}
              style={{
                width: `${(report.summary.toneCounts[tone] / total) * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(['decision', 'good', 'caution', 'average'] as FortuneCalendarTone[]).map((tone) => (
          <ToneSummaryCard
            key={tone}
            tone={tone}
            count={report.summary.toneCounts[tone]}
            entries={pickToneEntries(report, [tone], tone === 'average' ? 2 : 3, tone === 'caution' ? 'low' : 'high')}
            onSelect={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}

function DayFocusPanel({ entry }: { entry: FortuneCalendarMonthReport['days'][number] }) {
  const meta = TONE_META[entry.tone];
  const Icon = meta.icon;

  return (
    <div
      className="rounded-[16px] border p-4"
      style={{
        background: 'linear-gradient(135deg, var(--app-pink-soft), #fff)',
        borderColor: 'var(--app-pink-line)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${meta.badgeClassName}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            선택한 날
          </div>
          <h3
            className="mt-0.5 text-[16px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {formatDayLabel(entry)} · {meta.label}
          </h3>
          {/* 2026-05-15 — 그 날의 일진 ganzi 노출 (한자 + 한글 병기). 매일 다름. */}
          {entry.iljinGanzi ? (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--app-ink)]" style={{ border: '1px solid var(--app-pink-line)' }}>
              <span>일진</span>
              <span style={{ fontFamily: 'var(--font-han)' }}>
                {entry.iljinKorean ? `${entry.iljinKorean}(${entry.iljinGanzi})` : entry.iljinGanzi}
              </span>
              <span className="text-[10px] font-bold text-[var(--app-pink-strong)]">·</span>
              <span className="text-[10.5px] tabular-nums">{entry.score}점</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 2026-05-15 — 발동 신살 chip. 날짜마다 다른 셋. */}
      {entry.dayNotableSinsals && entry.dayNotableSinsals.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.dayNotableSinsals.map((s, idx) => {
            const tone =
              s.category === '길신'
                ? { bg: 'rgba(45,135,88,0.10)', border: 'rgba(45,135,88,0.32)', color: 'var(--app-jade)' }
                : s.category === '흉신'
                  ? { bg: 'rgba(220,79,79,0.08)', border: 'rgba(220,79,79,0.28)', color: 'var(--app-coral)' }
                  : { bg: '#fff7e6', border: 'rgba(212,148,38,0.28)', color: 'var(--app-amber)' };
            return (
              <span
                key={`${s.name}-${idx}`}
                className="rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
                style={{ background: tone.bg, borderColor: tone.border, color: tone.color }}
              >
                {s.name}
              </span>
            );
          })}
        </div>
      ) : null}

      <p
        className="mt-3 text-[13px] leading-[1.7] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {entry.summary}
      </p>
      <div
        className="mt-3 rounded-[14px] border bg-white p-3.5"
        style={{ borderColor: 'var(--app-pink-line)' }}
      >
        <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          오늘 할 일
        </div>
        <p
          className="mt-1.5 text-[13px] leading-[1.7] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {entry.actionHint}
        </p>
      </div>

      {/* 2026-05-15 — 일진 발동 케이스 메시지 추가 (운세톡톡 라이브러리). */}
      {entry.dayMessages && entry.dayMessages.length > 2 ? (
        <div className="mt-3 grid gap-1.5">
          {entry.dayMessages.slice(2).map((msg, idx) => (
            <p
              key={idx}
              className="rounded-[12px] border bg-white px-3 py-2 text-[12px] leading-[1.65] text-[var(--app-copy)]"
              style={{
                borderColor: 'var(--app-line)',
                wordBreak: 'keep-all',
              }}
            >
              {msg}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CalendarHintGroup({
  title,
  tone,
  entries,
}: {
  title: string;
  tone: FortuneCalendarTone;
  entries: FortuneCalendarMonthReport['days'];
}) {
  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          {title}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${TONE_META[tone].badgeClassName}`}>
          {TONE_META[tone].label}
        </span>
      </div>
      <div className="mt-2.5 grid gap-2">
        {entries.map((entry) => (
          <div
            key={`${title}-${entry.isoDate}`}
            className="rounded-[12px] border bg-white px-3 py-2.5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[12.5px] font-extrabold text-[var(--app-ink)]">{formatDayLabel(entry)}</div>
            <p
              className="mt-1.5 text-[12.5px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {entry.actionHint}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FortuneCalendarPanel({
  slug,
  targetYear,
  hasLifetimeAccess,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState(() => getInitialMonth(targetYear));
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<FortuneCalendarResponse | null>(null);
  // 2026-05-16 — 선택된 (slug, year-month) 의 monthly-calendar entitlement 조회.
  //   "1,900원으로 열기" link 를 중복 결제하지 않도록 미리 차단.
  const monthScope = `${targetYear}-${String(selectedMonth).padStart(2, '0')}`;
  const { hasEntitlement: hasMonthEntitlement, openHref: monthOpenHref } = useProductEntitlement({
    productId: 'monthly-calendar',
    slug,
    scope: monthScope,
    enabled: Boolean(slug),
  });
  const [unlocking, setUnlocking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState('loading');
      setError('');

      try {
        const response = await fetch(
          `/api/fortune-calendar?slug=${encodeURIComponent(slug)}&targetYear=${targetYear}&month=${selectedMonth}`,
          {
            signal: controller.signal,
          }
        );
        const payload = (await response.json().catch(() => null)) as
          | FortuneCalendarResponse
          | { error?: string }
          | null;

        if (!response.ok || !payload || !('ok' in payload) || payload.ok !== true) {
          setError(payload && 'error' in payload && payload.error ? payload.error : '운세 캘린더를 불러오지 못했습니다.');
          setState('error');
          return;
        }

        setData(payload);
        setState('ready');
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') return;
        setError('운세 캘린더를 불러오는 중 오류가 발생했습니다.');
        setState('error');
      }
    }

    void load();

    return () => controller.abort();
  }, [slug, targetYear, selectedMonth]);

  const placeholderWeeks = useMemo(
    () => buildPlaceholderWeeks(targetYear, selectedMonth),
    [targetYear, selectedMonth]
  );
  const calendarRows = useMemo(
    () =>
      data?.report
        ? data.report.weeks
        : placeholderWeeks.map((days, index) => ({
            week: index + 1,
            days,
          })),
    [data?.report, placeholderWeeks]
  );
  const focusEntry = useMemo(() => {
    if (!data?.report) return null;
    return data.report.days.find((entry) => entry.day === selectedDay) ?? pickDefaultFocusDay(data.report);
  }, [data?.report, selectedDay]);

  useEffect(() => {
    const defaultEntry = pickDefaultFocusDay(data?.report);
    setSelectedDay(defaultEntry?.day ?? null);
  }, [data?.report, selectedMonth]);

  async function handleUnlock() {
    trackMoonlightEvent('unlock_clicked', {
      from: 'fortune-calendar',
      slug,
      targetYear,
      month: selectedMonth,
      productCode: 'FORTUNE_CALENDAR_MONTH',
    });

    setUnlocking(true);
    setError('');

    try {
      const response = await fetch('/api/fortune-calendar/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          targetYear,
          month: selectedMonth,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success: true;
            access: 'lifetime' | 'month_unlock' | 'product_unlock';
            remaining: number | null;
            report: FortuneCalendarMonthReport;
          }
        | {
            error?: string;
            remaining?: number;
          }
        | null;

      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/saju/${slug}/premium#fortune-calendar`)}`;
        return;
      }

      if (response.status === 402) {
        window.location.href = `/credits?from=fortune-calendar&slug=${encodeURIComponent(slug)}`;
        return;
      }

      if (!response.ok || !payload || !('success' in payload) || payload.success !== true) {
        setError(payload && 'error' in payload && payload.error ? payload.error : '월간 캘린더를 열지 못했습니다.');
        return;
      }

      setRemaining(payload.remaining);
      setData({
        ok: true,
        access: payload.access,
        targetYear,
        month: selectedMonth,
        monthLabel: payload.report.monthLabel,
        coinCost: 0,
        hasLifetimeAccess: payload.access === 'lifetime' || hasLifetimeAccess,
        report: payload.report,
      });
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section id="fortune-calendar" className="space-y-4">
      {/* §Hero — indigo tone (월별) + 月 한자 인장 + 권한 배지 */}
      <section
        className="relative overflow-hidden rounded-[20px] border p-5"
        style={{
          background: 'linear-gradient(180deg, #eef0fb 0%, #fff 100%)',
          borderColor: 'rgba(74,92,184,0.22)',
          boxShadow: '0 22px 50px -28px rgba(74,92,184,0.22)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(74,92,184,0.18), transparent 70%)' }}
        />
        <div className="relative flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[22px] font-extrabold text-white"
            style={{
              background: 'linear-gradient(135deg, #6b7bd1, #4a5cb8)',
              boxShadow: '0 10px 22px rgba(74,92,184,0.32)',
              fontFamily: 'var(--font-han)',
            }}
            aria-hidden="true"
          >
            月
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold text-white"
                style={{
                  background: hasLifetimeAccess ? 'var(--app-pink)' : '#4a5cb8',
                  boxShadow: hasLifetimeAccess
                    ? '0 4px 10px rgba(216,27,114,0.28)'
                    : '0 4px 10px rgba(74,92,184,0.28)',
                }}
              >
                {hasLifetimeAccess ? '✓ 소장권' : '월 단위 2코인'}
              </span>
              {data?.access === 'month_unlock' ? (
                <span className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold text-[var(--app-jade)]" style={{ borderColor: 'rgba(45,135,88,0.28)' }}>
                  ✓ 해제된 달
                </span>
              ) : null}
              {data?.access === 'product_unlock' ? (
                <span className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold text-[var(--app-jade)]" style={{ borderColor: 'rgba(45,135,88,0.28)' }}>
                  ✓ 구매한 달
                </span>
              ) : null}
            </div>
            <div
              className="mt-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
              style={{ color: '#4a5cb8' }}
            >
              Fortune Calendar
            </div>
            <h2
              className="mt-0.5 text-[20px] font-extrabold leading-[1.35] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              달별로 한눈에 보는
              <br />
              결정일과 주의 날
            </h2>
          </div>
        </div>

        {/* 12개월 chip */}
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <MonthChip
              key={month}
              month={month}
              active={month === selectedMonth}
              onClick={() => setSelectedMonth(month)}
            />
          ))}
        </div>

        {/* tone legend */}
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {(['decision', 'good', 'average', 'caution'] as FortuneCalendarTone[]).map((tone) => (
            <span
              key={tone}
              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold ${TONE_META[tone].badgeClassName}`}
            >
              {TONE_META[tone].label}
            </span>
          ))}
        </div>
      </section>

      {state === 'loading' ? (
        <section
          className="rounded-[20px] border p-6"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-center">
            <div
              className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[22px] font-extrabold"
              style={{
                background: '#fff',
                color: 'var(--app-pink-strong)',
                border: '1px solid var(--app-pink-line)',
                fontFamily: 'var(--font-han)',
                animation: 'gangi-float-y 3.6s ease-in-out infinite',
              }}
              aria-hidden="true"
            >
              月
            </div>
            <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              월별 캘린더 정리 중
            </div>
            <h2 className="mt-1.5 text-[19px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]">
              {selectedMonth}월의 결정일·주의 날을 정리하고 있어요
            </h2>
          </div>
        </section>
      ) : state === 'error' ? (
        <section
          className="rounded-[20px] border p-5"
          style={{
            background: '#fdecec',
            borderColor: 'rgba(198,69,69,0.22)',
          }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
            불러오기 실패
          </div>
          <p
            className="mt-1.5 text-[13.5px] leading-[1.7] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {error}
          </p>
        </section>
      ) : (
        <>
          {/* §Month headline + 캘린더 grid */}
          <section
            className="rounded-[20px] border bg-white p-5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  {data?.monthLabel ?? `${targetYear}년 ${selectedMonth}월`}
                </div>
                <p
                  className="mt-1 text-[15px] font-extrabold leading-[1.55] text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {data?.report?.summary.headline ?? '이 달의 흐름을 해제하면 날별 결을 바로 읽을 수 있습니다.'}
                </p>
              </div>
              {remaining !== null ? (
                <div className="shrink-0 rounded-full border bg-white px-2.5 py-1 text-[10.5px] font-extrabold text-[var(--app-copy-muted)]" style={{ borderColor: 'var(--app-line)' }}>
                  잔여 코인 {remaining}
                </div>
              ) : null}
            </div>

            {data?.report ? (
              <div className="mt-4">
                <CalendarMonthMap report={data.report} onSelectDay={setSelectedDay} />
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label, index) => (
                <div
                  key={label}
                  className="text-center text-[11px] font-extrabold"
                  style={{
                    color: index === 0 ? 'var(--app-coral)' : index === 6 ? '#4a5cb8' : 'var(--app-copy-soft)',
                  }}
                >
                  {label}
                </div>
              ))}

              {calendarRows.flatMap((week, weekIndex) =>
                week.days.map((cell, cellIndex) => {
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${weekIndex}-${cellIndex}`}
                        className="aspect-square rounded-[12px] border border-dashed bg-white"
                        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                      />
                    );
                  }

                  const tone = data?.report && isFortuneCalendarEntry(cell)
                    ? cell.tone
                    : ('average' as FortuneCalendarTone);
                  const isSelected = data?.report && isFortuneCalendarEntry(cell) && cell.day === selectedDay;
                  const content = (
                    <>
                      <div className="text-[13.5px] font-extrabold leading-none">{cell.day}</div>
                      {data?.report && isFortuneCalendarEntry(cell) ? (
                        <div className="mt-1.5 text-[9px] font-extrabold leading-none opacity-85">
                          {TONE_META[cell.tone].label}
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[9px] font-extrabold leading-none opacity-50">잠금</div>
                      )}
                    </>
                  );

                  if (data?.report && isFortuneCalendarEntry(cell)) {
                    return (
                      <button
                        key={`${selectedMonth}-${cell.day}-${weekIndex}-${cellIndex}`}
                        type="button"
                        onClick={() => setSelectedDay(cell.day)}
                        className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[12px] border px-1 py-1 transition-all active:scale-95 ${TONE_META[tone].cellClassName}`}
                        style={
                          isSelected
                            ? {
                                outline: '2px solid var(--app-pink)',
                                outlineOffset: 2,
                                transform: 'translateY(-1px)',
                                boxShadow: '0 8px 18px rgba(216,27,114,0.22)',
                              }
                            : undefined
                        }
                        aria-label={`${cell.day}일 ${TONE_META[cell.tone].label} 보기`}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={`${selectedMonth}-${cell.day}-${weekIndex}-${cellIndex}`}
                      className={`flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[12px] border px-1 py-1 ${TONE_META[tone].cellClassName}`}
                    >
                      {content}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* §Day focus + summary */}
          <section
            className="rounded-[20px] border bg-white p-5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            {data?.report ? (
              <>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  월간 판단
                </div>
                <p
                  className="mt-2 text-[13.5px] leading-[1.78] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {data.report.summary.summary}
                </p>

                {focusEntry ? (
                  <div className="mt-4">
                    <DayFocusPanel entry={focusEntry} />
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2">
                  <div className="yearly-tone-good rounded-[14px] border px-3.5 py-3">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]">
                      이번 달 먼저 움직일 날
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
                      {data.report.summary.decisionDays.join(' · ')}
                    </p>
                  </div>
                  <div className="yearly-tone-caution rounded-[14px] border px-3.5 py-3">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]">
                      확답을 늦추면 좋은 날
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
                      {data.report.summary.cautionDays.join(' · ')}
                    </p>
                  </div>
                </div>

                <details
                  className="group mt-4 rounded-[14px] border bg-white p-3.5"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12.5px] font-extrabold text-[var(--app-copy-muted)]">
                    <span>날짜별 행동 힌트 더 보기</span>
                    <span className="text-[10px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
                  </summary>
                  <div className="mt-3 grid gap-2">
                    <CalendarHintGroup
                      title="먼저 잡아볼 날"
                      tone="decision"
                      entries={pickToneEntries(data.report, ['decision'], 3, 'high')}
                    />
                    <CalendarHintGroup
                      title="가볍게 진행해도 좋은 날"
                      tone="good"
                      entries={pickToneEntries(data.report, ['good'], 3, 'high')}
                    />
                    <CalendarHintGroup
                      title="한 번 더 확인할 날"
                      tone="caution"
                      entries={pickToneEntries(data.report, ['caution'], 3, 'low')}
                    />
                  </div>
                </details>
              </>
            ) : (
              <>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  잠금 안내
                </div>
                <h3
                  className="mt-1 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {selectedMonth}월 흐름을 열면 좋은 날과 주의 날이 바로 갈립니다
                </h3>
                <p
                  className="mt-2 text-[13px] leading-[1.78] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  이 달의 캘린더를 열면 결정일·좋은 날·보통 날·주의 날이 색으로 정리되고, 각 날짜에 무엇을 바로 해도 되는지와 무엇을 늦춰야 하는지 바로 읽을 수 있습니다.
                </p>
                <div
                  className="mt-4 rounded-[14px] border bg-white p-4"
                  style={{ borderColor: 'var(--app-pink-line)' }}
                >
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                    열리면 보이는 것
                  </div>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {(['decision', 'good', 'caution', 'average'] as FortuneCalendarTone[]).map((tone) => {
                      const meta = TONE_META[tone];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={tone}
                          className={`rounded-[12px] border px-3 py-2.5 ${meta.badgeClassName}`}
                        >
                          <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            {meta.label}
                          </div>
                          <p
                            className="mt-1.5 text-[11.5px] leading-[1.6]"
                            style={{ wordBreak: 'keep-all' }}
                          >
                            {meta.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {/* 2026-05-16 — 이미 구매한 월이면 "이미 구매" 안내 + 즉시 열람.
                      미구매면 기존 unlock + 결제 CTA 그대로 노출. */}
                  {hasMonthEntitlement ? (
                    <Link
                      href={monthOpenHref ?? `/saju/${encodeURIComponent(slug)}/premium#fortune-calendar`}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-jade)] text-[14px] font-extrabold text-white"
                    >
                      ✓ 이미 구매한 {selectedMonth}월 캘린더 열기
                    </Link>
                  ) : (
                    <>
                      <Button
                        onClick={() => void handleUnlock()}
                        disabled={unlocking}
                        className="h-12 rounded-full text-[14px] font-extrabold"
                      >
                        {unlocking ? '여는 중...' : `${selectedMonth}월 캘린더 2코인으로 열기`}
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/membership/checkout?product=monthly-calendar&slug=${encodeURIComponent(slug)}&scope=${targetYear}-${String(selectedMonth).padStart(2, '0')}&from=fortune-calendar`}
                          className="inline-flex h-11 items-center justify-center rounded-full border bg-white text-[12.5px] font-extrabold text-[var(--app-pink-strong)]"
                          style={{ borderColor: 'var(--app-pink-line)' }}
                        >
                          1,900원으로 열기
                        </Link>
                        <Link
                          href={`/credits?from=fortune-calendar&slug=${encodeURIComponent(slug)}`}
                          className="inline-flex h-11 items-center justify-center rounded-full border bg-white text-[12.5px] font-extrabold text-[var(--app-copy-muted)]"
                          style={{ borderColor: 'var(--app-line)' }}
                        >
                          코인팩 보기
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
