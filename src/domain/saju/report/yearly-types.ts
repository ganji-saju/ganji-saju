import type { Element } from '@/lib/saju/types';
import type { ReportMetadata } from '@/lib/saju/report-contract';
import type { MonthSignals } from './monthly-signals';
import type {
  ReportEvidenceCard,
  ReportScore,
  ReportTimelineItem,
} from './types';

export type YearlyReportDetailLevel = 'foundation' | 'monthly-evidence';
export type YearlyMonthlyPrecision = 'seasonal-outline' | 'monthly-ganji';

export type YearlyReferenceTopic =
  | 'today'
  | 'love'
  | 'wealth'
  | 'career'
  | 'relationship';

export type YearlyCategoryKey =
  | 'work'
  | 'wealth'
  | 'love'
  | 'relationship'
  | 'health'
  | 'move';

export type YearlyMomentum = 'rise' | 'steady' | 'caution';

// 2026-05-15 PR 5 — 사주아이 reference: 12개월 중 가장 흐름이 좋은 'peak' / 가장 흐름이
// 흔들리는 'pitfall' 을 1개씩 마킹해 사용자에게 시각 강조.
export type YearlyPeakKind = 'peak' | 'pitfall' | null;

export interface YearlyComputationMeta {
  detailLevel: YearlyReportDetailLevel;
  monthlyPrecision: YearlyMonthlyPrecision;
  referenceDate: string;
  timezone: string;
}

export interface YearlyKeyword {
  label: string;
  reason: string;
}

export interface YearlyOverviewBlock {
  headline: string;
  summary: string;
  basis: string[];
}

export interface YearlyHalfFlow {
  label: 'firstHalf' | 'secondHalf';
  headline: string;
  summary: string;
  opportunity: string;
  caution: string;
  action: string;
  relatedMonths: number[];
  basis: string[];
}

export interface YearlyCategorySection {
  key: YearlyCategoryKey;
  headline: string;
  summary: string;
  opportunity: string;
  caution: string;
  action: string;
  score?: number;
  relatedMonths: number[];
  basis: string[];
}

export interface YearlyMonthFlow {
  month: number;
  label: string;
  monthlyGanji: string | null;
  momentum: YearlyMomentum;
  theme: string;
  focusQuestion: string;
  summary: string;
  opportunity: string;
  caution: string;
  action: string;
  relatedAreas: YearlyCategoryKey[];
  basis: string[];
  /** 그 달 천간 오행과 태어난 날 오행의 관계(0 같음·1 내가 낳음·2 내가 다룸·3 나를 다잡음·4 나를 도움). 문장 가르기용. */
  relationStep?: number | null;
  /** 2026-05-15 PR 5 — Peak/Pitfall 시각 강조. 1년 중 1 peak + 1 pitfall 까지만. */
  peakKind?: YearlyPeakKind;
  /** 2026-10-10 — 그 달 월운 근거(십성·원국 합충·용신 적합·절기 기간). 옛 캐시에는 없다. */
  signals?: MonthSignals;
  /** 그 달에 채우면 좋은 기운과 그 색·방향(용신 기준). */
  supplement?: { element: Element; colors: string[]; directions: string[] } | null;
}

export interface YearlyTimingWindow {
  label: string;
  months: number[];
  reason: string;
  strategy: string;
}

export interface YearlyActionGuide {
  useWhenStrong: string[];
  defendWhenWeak: string[];
}

export interface YearlyFlowContext {
  yearGanji: string;
  currentMajorLuck: string | null;
  strength: string | null;
  pattern: string | null;
  yongsinLabels: string[];
  supportElements: Element[];
  cautionElements: Element[];
  /** 그해 천간 오행과 태어난 날 오행의 관계 한 구절('나를 돕는 기운이 들어와 …'). 사람마다 다른 첫머리용. */
  yearTheme?: string | null;
  /** 위 관계의 번호(0~4). 분야별 연간 문장 선택용. */
  yearStep?: 0 | 1 | 2 | 3 | 4 | null;
}

export interface YearlyReferenceReport {
  topic: YearlyReferenceTopic;
  focusLabel: string;
  headline: string;
  summary: string;
  score: number | null;
  primaryAction: string;
  cautionAction: string;
  highlights: string[];
  timeline: ReportTimelineItem[];
  luckyDates: string[];
  cautionDates: string[];
}

export interface SajuYearlyReport {
  year: number;
  yearLabel: string;
  computation: YearlyComputationMeta;
  annualContext: YearlyFlowContext;
  overview: YearlyOverviewBlock;
  coreKeywords: YearlyKeyword[];
  firstHalf: YearlyHalfFlow;
  secondHalf: YearlyHalfFlow;
  categoryOrder: YearlyCategoryKey[];
  categories: Record<YearlyCategoryKey, YearlyCategorySection>;
  monthlyFlows: YearlyMonthFlow[];
  goodPeriods: YearlyTimingWindow[];
  cautionPeriods: YearlyTimingWindow[];
  actionGuide: YearlyActionGuide;
  oneLineSummary: string;
  evidenceCards: ReportEvidenceCard[];
  scores: ReportScore[];
  referenceReports: Record<YearlyReferenceTopic, YearlyReferenceReport>;
  metadata?: ReportMetadata;
}
