import type { Element } from '@/lib/saju/types';
import type { ReportMetadata } from '@/lib/saju/report-contract';
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
  /** 2026-05-15 PR 5 — Peak/Pitfall 시각 강조. 1년 중 1 peak + 1 pitfall 까지만. */
  peakKind?: YearlyPeakKind;
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
