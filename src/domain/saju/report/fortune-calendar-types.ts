export type FortuneCalendarTone = 'decision' | 'good' | 'average' | 'caution';

export interface FortuneCalendarDayEntry {
  isoDate: string;
  day: number;
  weekday: number;
  tone: FortuneCalendarTone;
  score: number;
  title: string;
  summary: string;
  actionHint: string;
  /** 2026-05-15 — 그 날의 일진 ganzi (한자 2자). 예: "丁酉". */
  iljinGanzi?: string;
  /** 한글 발음 (예: "정유"). */
  iljinKorean?: string;
  /** 일진 발동 케이스 메시지 (운세톡톡 벤치마크 라이브러리). 1~2개. */
  dayMessages?: string[];
  /** 그 날 사주와 일진 사이에 발동한 신살 (길신/흉신/양날). 위치 정보 포함. */
  dayNotableSinsals?: Array<{ name: string; category: '길신' | '흉신' | '양날의검' }>;
}

export interface FortuneCalendarWeekRow {
  week: number;
  days: Array<FortuneCalendarDayEntry | null>;
}

export interface FortuneCalendarMonthSummary {
  headline: string;
  summary: string;
  toneCounts: Record<FortuneCalendarTone, number>;
  keyStrength: string;
  cautionLine: string;
  decisionDays: string[];
  goodDays: string[];
  bestDays: string[];
  cautionDays: string[];
}

export interface FortuneCalendarMonthReport {
  year: number;
  month: number;
  monthLabel: string;
  totalDays: number;
  weeks: FortuneCalendarWeekRow[];
  days: FortuneCalendarDayEntry[];
  summary: FortuneCalendarMonthSummary;
}
