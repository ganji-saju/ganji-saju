import { Solar } from 'lunar-typescript';
import {
  calculateSajuDataV1,
  type SajuDataV1,
} from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { buildSajuReport } from './build-report';
import { ELEMENT_INFO, getLuckyElementsFromSajuData } from '@/lib/saju/elements';
import type { BirthInput } from '@/lib/saju/types';
import type {
  FortuneCalendarDayEntry,
  FortuneCalendarMonthReport,
  FortuneCalendarTone,
  FortuneCalendarWeekRow,
} from './fortune-calendar-types';
// 2026-05-15 — 결제 후 날짜 클릭 시 같은 풀이만 반복되던 문제 fix.
// 각 날짜의 실제 일진(日辰) 을 계산해 PR #105 메시지 라이브러리 + #106 신살 탐지 결과를
// 일별 entry 에 넣어, 사용자가 날짜를 누를 때마다 실제로 다른 콘텐츠를 보게 한다.
import { pickIljinMessages } from '@/lib/today-fortune/iljin-case-picker';
import { detectComprehensiveSinsals } from '@/lib/today-fortune/sinsal-comprehensive';
import type { Branch, Stem } from '@/lib/today-fortune/iljin-rules';
// 2026-05-19 fix — 일진 ganzi 기반 통일 점수 helper (사주 메인/상세/오늘 운세와 동일).
//   PR #179/#180/#181 의 통일에서 fortune-calendar 만 누락된 경로를 fix.
import { computeSajuIljinScore } from '@/server/today-fortune/build-today-fortune';

// 한자 ganzi → 한글.
const STEM_KOR: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const BRANCH_KOR: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

function ganziToKorean(ganzi: string): string {
  const s = STEM_KOR[ganzi.charAt(0) ?? ''] ?? '';
  const b = BRANCH_KOR[ganzi.charAt(1) ?? ''] ?? '';
  return `${s}${b}`;
}

function computeDayIljin(year: number, month: number, day: number): { ganzi: string; stem: string; branch: string } | null {
  try {
    const solar = Solar.fromYmdHms(year, month, day, 12, 0, 0);
    const dayGanzi = solar.getLunar().getEightChar().getDay();
    return {
      ganzi: dayGanzi,
      stem: dayGanzi.charAt(0) ?? '',
      branch: dayGanzi.charAt(1) ?? '',
    };
  } catch {
    return null;
  }
}

function computeDayGanziIndex(stem: string, branch: string): number {
  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const si = STEMS.indexOf(stem);
  const bi = BRANCHES.indexOf(branch);
  if (si < 0 || bi < 0) return 0;
  for (let k = 0; k < 6; k += 1) {
    if ((si + 10 * k) % 12 === bi) return si + 10 * k;
  }
  return 0;
}

interface FortuneCalendarDayDraft {
  isoDate: string;
  day: number;
  weekday: number;
  score: number;
  summary: string;
  actionHint: string;
  iljinGanzi?: string;
  iljinKorean?: string;
  dayMessages?: string[];
  dayNotableSinsals?: Array<{ name: string; category: '길신' | '흉신' | '양날의검' }>;
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
  sourceData: SajuDataV1 | SajuDataV2,
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
  // 2026-05-19 fix: 일진 ganzi 기반 통일 점수 (사주 메인/상세/오늘 운세와 동일 helper).
  //   기존 buildSajuReport.scores.overall 은 사주 원국 + 사용자 생일만 의존 →
  //   calculatedAt(그 날) 영향 0 → 한 달 30+ 일이 모두 같은 점수로 노출되던 버그.
  //   PR #179/#180/#181 의 통일에서 fortune-calendar 만 누락된 경로를 fix.
  const iljinScoreResult = computeSajuIljinScore(sourceData, { now: new Date(referenceDate) });
  const overall =
    iljinScoreResult?.totalScore ??
    report.scores.find((item) => item.key === 'overall')?.score ??
    68;
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

  // 2026-05-15 — 그 날의 실제 일진 + 발동 케이스 메시지 + 신살.
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;
  const iljin = computeDayIljin(year, month, day);
  let dayMessages: string[] | undefined;
  let dayNotableSinsals: Array<{ name: string; category: '길신' | '흉신' | '양날의검' }> | undefined;
  let perDaySummary = summary;
  let perDayActionHint = actionHint;

  if (iljin) {
    try {
      const elementPercentages = {
        목: sourceData.fiveElements.byElement['목']?.percentage ?? 0,
        화: sourceData.fiveElements.byElement['화']?.percentage ?? 0,
        토: sourceData.fiveElements.byElement['토']?.percentage ?? 0,
        금: sourceData.fiveElements.byElement['금']?.percentage ?? 0,
        수: sourceData.fiveElements.byElement['수']?.percentage ?? 0,
      };
      const sajuInput = {
        dayMaster: sourceData.pillars.day.stem as Stem,
        dayMasterElement: sourceData.dayMaster.element as '목' | '화' | '토' | '금' | '수',
        yearStem: sourceData.pillars.year.stem as Stem,
        yearBranch: sourceData.pillars.year.branch as Branch,
        monthStem: sourceData.pillars.month.stem as Stem,
        monthBranch: sourceData.pillars.month.branch as Branch,
        dayBranch: sourceData.pillars.day.branch as Branch,
        hourStem: (sourceData.pillars.hour?.stem ?? null) as Stem | null,
        hourBranch: (sourceData.pillars.hour?.branch ?? null) as Branch | null,
        elementPercentages,
        strengthLabel: sourceData.strength?.level ?? null,
        yongsinElement: null,
        kishinElement: null,
      };

      const picked = pickIljinMessages(
        sajuInput,
        iljin.stem as Stem,
        iljin.branch as Branch,
        { name: input.name ?? '선생님' },
        `${isoDate}::${sourceData.pillars.day.ganzi}`,
        2
      );
      dayMessages = picked.messages;
      // 일별 summary 를 발동 케이스 1번 메시지로 교체 → 날짜마다 진짜 다른 카피.
      if (picked.messages.length > 0) {
        perDaySummary = picked.messages[0]!;
      }
      if (picked.messages.length > 1) {
        perDayActionHint = picked.messages[1]!;
      }

      // 신살 탐지 (사주 원국 + 일진).
      const dayGanziIndex = computeDayGanziIndex(
        sourceData.pillars.day.stem,
        sourceData.pillars.day.branch
      );
      const sinsalHits = detectComprehensiveSinsals(
        { ...sajuInput, dayGanziIndex },
        { iljin: { stem: iljin.stem as Stem, branch: iljin.branch as Branch } }
      );
      // 일진과 상호작용으로 발동한 것 우선 (positions 에 iljin 포함).
      const iljinHits = sinsalHits.filter((h) => h.positions.includes('iljin'));
      dayNotableSinsals = (iljinHits.length > 0 ? iljinHits : sinsalHits.slice(0, 3)).slice(0, 3).map((h) => ({
        name: h.name,
        category: h.category,
      }));
    } catch {
      // 일진 계산 실패 시 graceful fallback — 기존 summary/actionHint 그대로.
    }
  }

  return {
    isoDate,
    day,
    weekday: new Date(year, month - 1, day).getDay(),
    score: overall,
    summary: perDaySummary,
    actionHint: perDayActionHint,
    iljinGanzi: iljin?.ganzi,
    iljinKorean: iljin ? ganziToKorean(iljin.ganzi) : undefined,
    dayMessages,
    dayNotableSinsals,
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
  sourceData: SajuDataV1 | SajuDataV2,
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
