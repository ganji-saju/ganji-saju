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
    cellClassName: 'border-[var(--app-gold)]/55 bg-[rgba(210,176,114,0.22)] text-[var(--app-gold-text)] shadow-[0_0_18px_rgba(210,176,114,0.14)]',
    badgeClassName: 'border-[var(--app-gold)]/35 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)]',
    railClassName: 'bg-[var(--app-gold)]',
    icon: Target,
  },
  good: {
    label: '좋은 날',
    description: '연락하고, 정리하고, 가볍게 진행해도 좋은 날',
    cellClassName: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    railClassName: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  average: {
    label: '보통 날',
    description: '큰 결정보다 루틴과 확인을 쌓기 좋은 날',
    cellClassName: 'border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] text-[var(--app-copy)]',
    badgeClassName: 'border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy-soft)]',
    railClassName: 'bg-[var(--app-line)]',
    icon: CircleDot,
  },
  caution: {
    label: '주의 날',
    description: '돈, 말, 확답은 한 번 더 확인하는 날',
    cellClassName: 'border-rose-200 bg-rose-50 text-rose-900',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-800',
    railClassName: 'bg-rose-500',
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
      className={
        active
          ? 'rounded-full border border-[var(--app-gold)]/35 bg-[var(--app-gold)]/12 px-3 py-1.5 text-xs font-semibold text-[var(--app-gold-text)]'
          : 'rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs text-[var(--app-copy)] transition-colors hover:bg-[rgba(255,255,255,0.06)]'
      }
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
    <div className="rounded-[20px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] p-4">
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${meta.badgeClassName}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-[var(--app-ivory)]">{meta.label}</div>
            <div className="text-lg font-semibold text-[var(--app-gold-text)]">{count}일</div>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--app-copy-muted)]">{meta.description}</p>
        </div>
      </div>
      {entries.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {entries.map((entry) => (
            <button
              key={`${tone}-${entry.isoDate}`}
              type="button"
              onClick={() => onSelect(entry.day)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${meta.badgeClassName}`}
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
    <div className="rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="app-caption text-[var(--app-gold-soft)]">월간 지도</div>
          <div className="mt-2 text-sm font-semibold text-[var(--app-ivory)]">먼저 볼 날을 색으로 나눴습니다</div>
        </div>
        <CalendarDays className="size-5 text-[var(--app-gold-soft)]" aria-hidden="true" />
      </div>

      <div className="mt-4 overflow-hidden rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)]">
        <div className="flex h-3">
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
    <div className="rounded-[22px] border border-[var(--app-gold)]/20 bg-[linear-gradient(135deg,rgba(210,176,114,0.12),rgba(255,255,255,0.025))] p-4">
      <div className="flex items-start gap-3">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${meta.badgeClassName}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <div className="app-caption text-[var(--app-gold-soft)]">선택한 날</div>
          <h3 className="mt-2 text-xl font-semibold text-[var(--app-ivory)]">
            {formatDayLabel(entry)} · {meta.label}
          </h3>
          <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{entry.summary}</p>
        </div>
      </div>
      <div className="mt-4 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-gold-text)]">
          <Clock3 className="size-4" aria-hidden="true" />
          오늘 할 일
        </div>
        <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{entry.actionHint}</p>
      </div>
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
    <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="app-caption text-[var(--app-gold-soft)]">{title}</div>
        <Badge className={TONE_META[tone].badgeClassName}>{TONE_META[tone].label}</Badge>
      </div>
      <div className="mt-3 grid gap-3">
        {entries.map((entry) => (
          <div key={`${title}-${entry.isoDate}`} className="rounded-[14px] bg-[rgba(255,255,255,0.03)] px-3 py-3">
            <div className="text-sm font-semibold text-[var(--app-ivory)]">{formatDayLabel(entry)}</div>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{entry.actionHint}</p>
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
    <section id="fortune-calendar" className="gangi-report-panel p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="app-caption">Fortune Calendar</div>
          <h2 className="mt-4 text-3xl text-[var(--app-ivory)]">
            달별로 한눈에 보는 결정일과 주의 날
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={hasLifetimeAccess ? TONE_META.decision.badgeClassName : TONE_META.average.badgeClassName}>
            {hasLifetimeAccess ? '소장권 열람' : '월 단위 2코인'}
          </Badge>
          {data?.access === 'month_unlock' ? (
            <Badge className={TONE_META.good.badgeClassName}>해제된 달</Badge>
          ) : null}
          {data?.access === 'product_unlock' ? (
            <Badge className={TONE_META.good.badgeClassName}>구매한 달</Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
          <MonthChip
            key={month}
            month={month}
            active={month === selectedMonth}
            onClick={() => setSelectedMonth(month)}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['decision', 'good', 'average', 'caution'] as FortuneCalendarTone[]).map((tone) => (
          <Badge key={tone} className={TONE_META[tone].badgeClassName}>
            {TONE_META[tone].label}
          </Badge>
        ))}
      </div>

      {state === 'loading' ? (
        <div className="mt-6 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="h-[360px] animate-pulse rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)]" />
          <div className="h-[360px] animate-pulse rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)]" />
        </div>
      ) : state === 'error' ? (
        <div className="mt-6 rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-5 py-5 text-sm text-rose-100">
          {error}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
          <article className="rounded-[26px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="app-caption">{data?.monthLabel ?? `${targetYear}년 ${selectedMonth}월`}</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-ivory)]">
                  {data?.report?.summary.headline ?? '이 달의 흐름을 해제하면 날별 결을 바로 읽을 수 있습니다.'}
                </div>
              </div>
              {remaining !== null ? (
                <div className="text-xs text-[var(--app-copy-soft)]">잔여 코인 {remaining}개</div>
              ) : null}
            </div>

            {data?.report ? (
              <div className="mt-5">
                <CalendarMonthMap report={data.report} onSelectDay={setSelectedDay} />
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-center text-xs font-semibold text-[var(--app-copy-soft)]">
                  {label}
                </div>
              ))}

              {calendarRows.flatMap((week, weekIndex) =>
                week.days.map((cell, cellIndex) => {
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${weekIndex}-${cellIndex}`}
                        className="aspect-square rounded-[18px] border border-dashed border-[var(--app-line)]/60 bg-[rgba(255,255,255,0.015)]"
                      />
                    );
                  }

                  const tone = data?.report && isFortuneCalendarEntry(cell)
                    ? cell.tone
                    : ('average' as FortuneCalendarTone);
                  const isSelected = data?.report && isFortuneCalendarEntry(cell) && cell.day === selectedDay;
                  const content = (
                    <>
                      <div className="text-sm font-semibold">{cell.day}</div>
                      {data?.report && isFortuneCalendarEntry(cell) ? (
                        <div className="mt-2 text-[10px] leading-4 opacity-90">{TONE_META[cell.tone].label}</div>
                      ) : (
                        <div className="mt-2 text-[10px] leading-4 opacity-60">잠금</div>
                      )}
                    </>
                  );

                  if (data?.report && isFortuneCalendarEntry(cell)) {
                    return (
                      <button
                        key={`${selectedMonth}-${cell.day}-${weekIndex}-${cellIndex}`}
                        type="button"
                        onClick={() => setSelectedDay(cell.day)}
                        className={`relative aspect-square overflow-hidden rounded-[18px] border px-2 py-2 text-left transition-transform active:scale-95 ${TONE_META[tone].cellClassName} ${
                          isSelected ? 'ring-2 ring-[var(--app-gold)]/60 ring-offset-2 ring-offset-[var(--app-bg)]' : ''
                        }`}
                        aria-label={`${cell.day}일 ${TONE_META[cell.tone].label} 보기`}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={`${selectedMonth}-${cell.day}-${weekIndex}-${cellIndex}`}
                      className={`relative aspect-square overflow-hidden rounded-[18px] border px-2 py-2 ${TONE_META[tone].cellClassName}`}
                    >
                      {content}
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="rounded-[26px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] p-5">
            {data?.report ? (
              <>
                <div className="app-caption">월간 판단</div>
                <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{data.report.summary.summary}</p>

                {focusEntry ? (
                  <div className="mt-5">
                    <DayFocusPanel entry={focusEntry} />
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3">
                  <div className="yearly-tone-good rounded-[18px] border px-4 py-4">
                    <div className="app-caption">이번 달 먼저 움직일 날</div>
                    <p className="mt-3 text-sm leading-7">
                      {data.report.summary.decisionDays.join(' · ')}
                    </p>
                  </div>
                  <div className="yearly-tone-caution rounded-[18px] border px-4 py-4">
                    <div className="app-caption">확답을 늦추면 좋은 날</div>
                    <p className="mt-3 text-sm leading-7">{data.report.summary.cautionDays.join(' · ')}</p>
                  </div>
                </div>

                <details className="mt-5 rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--app-gold-text)]">
                    날짜별 행동 힌트 더 보기
                  </summary>
                  <div className="mt-4 grid gap-3">
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
                <div className="app-caption">잠금 안내</div>
                <h3 className="mt-3 text-2xl text-[var(--app-gold-text)]">
                  {selectedMonth}월 흐름을 열면 좋은 날과 주의 날이 바로 갈립니다
                </h3>
                <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
                  이 달의 캘린더를 열면 결정일, 좋은 날, 보통 날, 주의 날이 색으로 정리되고, 각 날짜에 무엇을 바로 해도 되는지와 무엇을 늦춰야 하는지 바로 읽을 수 있습니다.
                </p>
                <div className="mt-5 rounded-[20px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                  <div className="app-caption text-[var(--app-gold-soft)]">열리면 보이는 것</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(['decision', 'good', 'caution', 'average'] as FortuneCalendarTone[]).map((tone) => {
                      const meta = TONE_META[tone];
                      const Icon = meta.icon;
                      return (
                        <div key={tone} className="rounded-[16px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-3 py-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-ivory)]">
                            <Icon className="size-4 text-[var(--app-gold-soft)]" aria-hidden="true" />
                            {meta.label}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-[var(--app-copy-muted)]">{meta.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    onClick={() => void handleUnlock()}
                    disabled={unlocking}
                  >
                    {unlocking ? '여는 중...' : `${selectedMonth}월 캘린더 2코인으로 열기`}
                  </Button>
                  <Link
                    href={`/membership/checkout?product=monthly-calendar&slug=${encodeURIComponent(slug)}&scope=${targetYear}-${String(selectedMonth).padStart(2, '0')}&from=fortune-calendar`}
                    className="gangi-secondary-button"
                  >
                    1,900원으로 열기
                  </Link>
                  <Link
                    href={`/credits?from=fortune-calendar&slug=${encodeURIComponent(slug)}`}
                    className="gangi-secondary-button"
                  >
                    코인팩 보기
                  </Link>
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
