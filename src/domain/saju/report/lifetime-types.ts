import type { ReportEvidenceCard } from './types';
import type { ReportMetadata } from '@/lib/saju/report-contract';

export interface LifetimeKeyword {
  label: string;
  reason: string;
}

export interface LifetimePillarSummary {
  year: string;
  month: string;
  day: string;
  hour: string | null;
}

export interface LifetimeCoverSection {
  headline: string;
  oneLineSummary: string;
  keywords: LifetimeKeyword[];
  lifetimeRule: string;
  basis: string[];
}

export interface LifetimeCoreIdentitySection {
  headline: string;
  summary: string;
  reactionStyle: string;
  bestEnvironment: string;
  weakPattern: string;
  basis: string[];
}

export interface LifetimeStrengthBalanceSection {
  headline: string;
  summary: string;
  strongAxis: string;
  weakAxis: string;
  energyDrain: string;
  recovery: string;
  balanceGuide: string[];
  elementHighlights: string[];
  basis: string[];
}

export interface LifetimePatternAndYongsinSection {
  headline: string;
  summary: string;
  patternRole: string;
  yongsinDirection: string;
  choiceRule: string;
  supportSymbols: string[];
  cautionSymbols: string[];
  practicalActions: string[];
  detailLines: string[];
  basis: string[];
}

export interface LifetimeRelationshipPatternSection {
  headline: string;
  summary: string;
  distanceStyle: string;
  expressionStyle: string;
  conflictTriggers: string;
  longevityGuide: string;
  basis: string[];
}

export interface LifetimeWealthStyleSection {
  headline: string;
  summary: string;
  earningStyle: string;
  keepingStyle: string;
  spendingMistakes: string;
  operatingStyle: string;
  basis: string[];
}

export interface LifetimeCareerDirectionSection {
  headline: string;
  summary: string;
  fitStructure: string;
  endureVsShine: string;
  independenceStyle: string;
  recognitionStyle: string;
  basis: string[];
}

export interface LifetimeHealthRhythmSection {
  headline: string;
  summary: string;
  warningSignals: string;
  recoveryRoutine: string;
  habitPoints: string[];
  basis: string[];
}

export type LifetimeLuckPhase =
  | '성장기'
  | '표현기'
  | '기반기'
  | '결정기'
  | '준비기'
  | '전환기';

export interface LifetimeMajorLuckCycle {
  ganzi: string;
  ageLabel: string;
  phase: LifetimeLuckPhase;
  summary: string;
  task: string;
  isCurrent: boolean;
}

export interface LifetimeMajorLuckTimelineSection {
  headline: string;
  summary: string;
  currentMeaning: string;
  cycles: LifetimeMajorLuckCycle[];
  basis: string[];
}

export interface LifetimeStrategySection {
  headline: string;
  summary: string;
  useWhenStrong: string[];
  defendWhenShaken: string[];
  rememberRules: string[];
  basis: string[];
}

export interface LifetimeYearlyAppendix {
  year: number;
  yearLabel: string;
  yearGanji: string;
  headline: string;
  oneLineSummary: string;
  firstHalf: string;
  secondHalf: string;
  goodPeriods: string[];
  cautionPeriods: string[];
  actionAdvice: string[];
  ctaLabel: string;
  ctaAnchor: string;
  basis: string[];
}

export interface SajuLifetimeReport {
  targetYear: number;
  pillars: LifetimePillarSummary;
  cover: LifetimeCoverSection;
  coreIdentity: LifetimeCoreIdentitySection;
  strengthBalance: LifetimeStrengthBalanceSection;
  patternAndYongsin: LifetimePatternAndYongsinSection;
  relationshipPattern: LifetimeRelationshipPatternSection;
  wealthStyle: LifetimeWealthStyleSection;
  careerDirection: LifetimeCareerDirectionSection;
  healthRhythm: LifetimeHealthRhythmSection;
  majorLuckTimeline: LifetimeMajorLuckTimelineSection;
  lifetimeStrategy: LifetimeStrategySection;
  yearlyAppendix: LifetimeYearlyAppendix;
  evidenceCards: ReportEvidenceCard[];
  metadata?: ReportMetadata;
}
