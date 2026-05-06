import {
  calculateSajuDataV1,
  type SajuDataV1,
} from '@/domain/saju/engine/saju-data-v1';
import { buildSajuReport } from './build-report';
import { ELEMENT_INFO, getLuckyElementsFromSajuData } from '@/lib/saju/elements';
import type { BirthInput } from '@/lib/saju/types';
import type {
  FortuneCalendarDayEntry,
  FortuneCalendarMonthReport,
  FortuneCalendarTone,
  FortuneCalendarWeekRow,
} from './fortune-calendar-types';

interface FortuneCalendarDayDraft {
  isoDate: string;
  day: number;
  weekday: number;
  score: number;
  summary: string;
  actionHint: string;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function buildReferenceDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}T12:00:00.000Z`;
}

function formatDateLabel(year: number, month: number, day: number) {
  return `${year}.${pad(month)}.${pad(day)}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getMonthLabel(year: number, month: number) {
  return `${year}년 ${month}월`;
}

function getToneTitle(tone: FortuneCalendarTone) {
  switch (tone) {
    case 'decision':
      return '결정일';
    case 'good':
      return '좋은 날';
    case 'caution':
      return '주의 날';
    case 'average':
    default:
      return '보통 날';
  }
}

function compactStrings(values: Array<string | null | undefined>) {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
}

function pickDateLabels(
  days: FortuneCalendarDayEntry[],
  primaryTones: FortuneCalendarTone[],
  fallbackTones: FortuneCalendarTone[],
  compare: (left: FortuneCalendarDayEntry, right: FortuneCalendarDayEntry) => number,
  excludeLabels: string[] = []
) {
  const picked: string[] = [];
  const excluded = new Set(excludeLabels);

  const tryPush = (entry: FortuneCalendarDayEntry) => {
    const label = formatDateLabel(
      Number(entry.isoDate.slice(0, 4)),
      Number(entry.isoDate.slice(5, 7)),
      entry.day
    );
    if (excluded.has(label) || picked.includes(label)) return;
    picked.push(label);
  };

  [...days]
    .filter((entry) => primaryTones.includes(entry.tone))
    .sort(compare)
    .forEach(tryPush);

  if (picked.length < 4) {
    [...days]
      .filter((entry) => fallbackTones.includes(entry.tone))
      .sort(compare)
      .forEach(tryPush);
  }

  if (picked.length < 4) {
    [...days].sort(compare).forEach(tryPush);
  }

  return picked.slice(0, 4);
}

function createDayEntryDraft(
  input: BirthInput,
  sourceData: SajuDataV1,
  year: number,
  month: number,
  day: number
): FortuneCalendarDayDraft {
  const referenceDate = buildReferenceDate(year, month, day);
  const data = calculateSajuDataV1(input, {
    timezone: sourceData.input.timezone,
    location: sourceData.input.location,
    calculatedAt: referenceDate,
    engineVersion: 'legacy-typescript-v1-fortune-calendar',
  });
  const report = buildSajuReport(input, data, 'today');
  const overall = report.scores.find((item) => item.key === 'overall')?.score ?? 68;
  const supportLabels = getLuckyElementsFromSajuData(data)
    .map((element) => ELEMENT_INFO[element].name.split(' ')[0])
    .join(' · ');
  const cautionLabel = ELEMENT_INFO[data.fiveElements.weakest].name.split(' ')[0];
  const summary =
    report.summaryHighlights[0] ??
    report.primaryAction.description ??
    '오늘의 흐름은 속도보다 균형을 먼저 보는 편이 좋습니다.';
  const actionHint =
    overall <= 66
      ? `${report.cautionAction.description} ${cautionLabel} 보완을 우선하세요.`
      : `${report.primaryAction.description} ${supportLabels ? `${supportLabels} 기운을 살리는 선택` : '큰 결정보다 작은 실행'}이 좋습니다.`;

  return {
    isoDate: `${year}-${pad(month)}-${pad(day)}`,
    day,
    weekday: new Date(year, month - 1, day).getDay(),
    score: overall,
    summary,
    actionHint,
  };
}

function assignDayTones(drafts: FortuneCalendarDayDraft[]): FortuneCalendarDayEntry[] {
  const ranked = [...drafts].sort((left, right) => right.score - left.score);
  const total = ranked.length;
  const decisionCount = Math.min(3, Math.max(1, Math.round(total * 0.08)));
  const goodCount = Math.min(6, Math.max(4, Math.round(total * 0.18)));
  const cautionCount = Math.min(5, Math.max(3, Math.round(total * 0.15)));

  const decisionIsoDates = new Set(ranked.slice(0, decisionCount).map((item) => item.isoDate));
  const goodIsoDates = new Set(
    ranked.slice(decisionCount, decisionCount + goodCount).map((item) => item.isoDate)
  );
  const cautionIsoDates = new Set(ranked.slice(-cautionCount).map((item) => item.isoDate));

  return drafts.map((draft) => {
    let tone: FortuneCalendarTone = 'average';

    if (decisionIsoDates.has(draft.isoDate)) {
      tone = 'decision';
    } else if (cautionIsoDates.has(draft.isoDate)) {
      tone = 'caution';
    } else if (goodIsoDates.has(draft.isoDate)) {
      tone = 'good';
    }

    return {
      ...draft,
      tone,
      title: getToneTitle(tone),
    };
  });
}

function buildWeeks(days: FortuneCalendarDayEntry[]): FortuneCalendarWeekRow[] {
  if (days.length === 0) return [];

  const weeks: FortuneCalendarWeekRow[] = [];
  let cursor = 0;
  let weekIndex = 0;

  while (cursor < days.length) {
    const week: Array<FortuneCalendarDayEntry | null> = Array.from({ length: 7 }, () => null);

    if (weekIndex === 0) {
      const firstWeekday = days[0]?.weekday ?? 0;
      for (let slot = firstWeekday; slot < 7 && cursor < days.length; slot += 1) {
        week[slot] = days[cursor] ?? null;
        cursor += 1;
      }
    } else {
      for (let slot = 0; slot < 7 && cursor < days.length; slot += 1) {
        week[slot] = days[cursor] ?? null;
        cursor += 1;
      }
    }

    weeks.push({
      week: weekIndex + 1,
      days: week,
    });
    weekIndex += 1;
  }

  return weeks;
}

export function buildFortuneCalendarMonth(
  input: BirthInput,
  sourceData: SajuDataV1,
  year: number,
  month: number
): FortuneCalendarMonthReport {
  const totalDays = getDaysInMonth(year, month);
  const dayDrafts = Array.from({ length: totalDays }, (_, index) =>
    createDayEntryDraft(input, sourceData, year, month, index + 1)
  );
  const days = assignDayTones(dayDrafts);
  const weeks = buildWeeks(days);
  const toneCounts = days.reduce<Record<FortuneCalendarTone, number>>(
    (acc, item) => {
      acc[item.tone] += 1;
      return acc;
    },
    {
      decision: 0,
      good: 0,
      average: 0,
      caution: 0,
    }
  );
  const decisionDays = pickDateLabels(
    days,
    ['decision'],
    ['good'],
    (left, right) => right.score - left.score
  );
  const goodDays = pickDateLabels(
    days,
    ['good'],
    ['decision', 'average'],
    (left, right) => right.score - left.score,
    decisionDays
  );
  const bestDays = pickDateLabels(
    days,
    ['decision', 'good'],
    ['average'],
    (left, right) => right.score - left.score
  );
  const cautionDays = pickDateLabels(
    days,
    ['caution'],
    ['average'],
    (left, right) => left.score - right.score,
    bestDays
  );
  const headline =
    toneCounts.decision >= 3
      ? '결정일과 좋은 날이 분명하게 갈리는 달입니다.'
      : toneCounts.caution >= 5
        ? '서두르기보다 확인 절차를 늘려야 하는 달입니다.'
        : '보통 날 사이에서도 진행하기 좋은 날과 한 번 더 볼 날이 갈립니다.';
  const summary = compactStrings([
    `${getMonthLabel(year, month)}에는 결정일 ${toneCounts.decision}일, 좋은 날 ${toneCounts.good}일, 보통 날 ${toneCounts.average}일, 주의 날 ${toneCounts.caution}일로 읽힙니다.`,
    days.find((item) => item.tone === 'decision')?.summary ??
      days.find((item) => item.tone === 'good')?.summary ??
      null,
  ]).join(' ');

  return {
    year,
    month,
    monthLabel: getMonthLabel(year, month),
    totalDays,
    weeks,
    days,
    summary: {
      headline,
      summary,
      toneCounts,
      keyStrength:
        days.find((item) => item.tone === 'decision')?.actionHint ??
        days.find((item) => item.tone === 'good')?.actionHint ??
        '좋은 날에는 큰 결론보다 실행 순서를 먼저 정하는 편이 좋습니다.',
      cautionLine:
        days.find((item) => item.tone === 'caution')?.actionHint ??
        '주의 날에는 감정적 결정과 충동 결제를 줄이는 편이 안전합니다.',
      decisionDays,
      goodDays,
      bestDays,
      cautionDays,
    },
  };
}
