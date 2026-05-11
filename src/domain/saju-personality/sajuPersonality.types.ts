import type {
  PersonalityAxisScores,
  PersonalityProfile as BasePersonalityProfile,
  PersonalityProfileSource,
  PersonalityTypeCode,
} from '@/domain/personality/personality.types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';

export type SajuPersonalityJsonObject = Record<string, unknown>;

export const SAJU_PERSONALITY_LIFE_AREAS = [
  'basic',
  'love',
  'relationships',
  'work',
  'money_achievement',
  'year',
  'today',
] as const;

export type SajuPersonalityLifeArea = (typeof SAJU_PERSONALITY_LIFE_AREAS)[number];

export const SAJU_PERSONALITY_REPORT_TYPES = ['free', 'paid'] as const;

export type SajuPersonalityReportType = (typeof SAJU_PERSONALITY_REPORT_TYPES)[number];

export const SAJU_PERSONALITY_SCORE_AXES = [
  'innerEnergyScore',
  'expressionScore',
  'decisionScore',
  'executionRhythmScore',
  'relationshipSensitivityScore',
  'growthDirectionScore',
] as const;

export type SajuPersonalityScoreAxis = (typeof SAJU_PERSONALITY_SCORE_AXES)[number];

export interface SajuPersonalityScores {
  innerEnergyScore: number;
  expressionScore: number;
  decisionScore: number;
  executionRhythmScore: number;
  relationshipSensitivityScore: number;
  growthDirectionScore: number;
  totalClarityScore: number;
  scoreScale: '0-100';
  scoreMeaning: 'higher_means_clearer_trait_signal_not_better_or_worse';
  totalClarityMeaning: 'higher_means_saju_and_personality_facts_point_in_a_more_consistent_direction';
}

export type SajuPersonalityFactSource = 'saju' | 'personality' | 'fusion';

export interface SajuPersonalityFactSignal {
  key: string;
  label: string;
  description?: string;
  source: SajuPersonalityFactSource;
  weight?: number;
  confidence?: number;
}

export interface SajuPersonalityFacts {
  readingId?: string | null;
  chartVersion?: string;
  dayMaster?: string | null;
  primaryElements?: readonly string[];
  supportiveElements?: readonly string[];
  tensionElements?: readonly string[];
  seasonalTone?: string | null;
  timingSignals?: readonly SajuPersonalityFactSignal[];
  strengthSignals?: readonly SajuPersonalityFactSignal[];
  cautionSignals?: readonly SajuPersonalityFactSignal[];
  raw?: SajuPersonalityJsonObject;
}

export interface PersonalityFacts {
  typeCode?: PersonalityTypeCode | null;
  source?: PersonalityProfileSource;
  confidence?: number;
  axisScores?: PersonalityAxisScores;
  profileTitle?: string;
  keywords?: readonly string[];
  preferenceSignals?: readonly SajuPersonalityFactSignal[];
  cautionSignals?: readonly SajuPersonalityFactSignal[];
  raw?: SajuPersonalityJsonObject;
}

export interface FusionFacts {
  lifeArea: SajuPersonalityLifeArea;
  energyPattern: SajuPersonalityFusionPattern;
  expressionPattern: SajuPersonalityFusionPattern;
  decisionPattern: SajuPersonalityFusionPattern;
  executionPattern: SajuPersonalityFusionPattern;
  relationshipPattern: SajuPersonalityFusionPattern;
  growthPattern: SajuPersonalityFusionPattern;
  cautionPattern: SajuPersonalityFusionPattern;
  strongestAxis?: SajuPersonalityScoreAxis;
  lowestAxis?: SajuPersonalityScoreAxis;
  alignmentSignals?: readonly SajuPersonalityFactSignal[];
  frictionSignals?: readonly SajuPersonalityFactSignal[];
  growthSignals?: readonly SajuPersonalityFactSignal[];
  recommendedFocus?: string;
  raw?: SajuPersonalityJsonObject;
}

export const SAJU_PERSONALITY_FUSION_PATTERN_KEYS = [
  'energyPattern',
  'expressionPattern',
  'decisionPattern',
  'executionPattern',
  'relationshipPattern',
  'growthPattern',
  'cautionPattern',
] as const;

export type SajuPersonalityFusionPatternKey =
  (typeof SAJU_PERSONALITY_FUSION_PATTERN_KEYS)[number];

export interface SajuPersonalityFusionPattern {
  key: SajuPersonalityFusionPatternKey;
  title: string;
  summary: string;
  signals: readonly SajuPersonalityFactSignal[];
  actionHint?: string;
  confidence?: number;
}

export type SajuPersonalityChartInput = SajuDataV1 | SajuPersonalityFacts;

export type SajuPersonalityProfileInput =
  | BasePersonalityProfile
  | PersonalityFacts
  | {
      typeCode?: PersonalityTypeCode | null;
      source?: PersonalityProfileSource;
      confidence?: number;
      axisScores?: PersonalityAxisScores;
      answers?: BasePersonalityProfile['answers'];
      raw?: SajuPersonalityJsonObject;
    };

export interface BuildSajuPersonalityFactsInput {
  saju: SajuPersonalityChartInput;
  personalityProfile: SajuPersonalityProfileInput;
  lifeArea: SajuPersonalityLifeArea;
}

export interface BuildSajuPersonalityFactsResult {
  sajuFacts: SajuPersonalityFacts;
  personalityFacts: PersonalityFacts;
  fusionFacts: FusionFacts;
}

export const SAJU_PERSONALITY_REPORT_SECTION_KEYS = [
  'oneLineConclusion',
  'coreKeywords',
  'scoreSummary',
  'shortSajuReading',
  'shortPersonalityReading',
  'lockedCta',
  'definition',
  'sajuTexture',
  'personalityPattern',
  'strengths',
  'fatiguePattern',
  'relationshipSelf',
  'workStyle',
  'moneyAchievement',
  'growthStrategy',
  'todayAction',
] as const;

export type SajuPersonalityReportSectionKey =
  (typeof SAJU_PERSONALITY_REPORT_SECTION_KEYS)[number];

export interface SajuPersonalityReportSection {
  key: SajuPersonalityReportSectionKey;
  title: string;
  summary: string;
  body?: string;
  bullets?: readonly string[];
  locked?: boolean;
}

export interface SajuPersonalityReport {
  schemaVersion: 'saju-personality-report/v1';
  reportType: SajuPersonalityReportType;
  lifeArea: SajuPersonalityLifeArea;
  headline: string;
  scores: SajuPersonalityScores;
  sections: readonly SajuPersonalityReportSection[];
  lockedSections?: readonly SajuPersonalityReportSection[];
  safetyNote: string;
  generatedAt?: string;
}

export interface SajuPersonalityReportRecord {
  id: string;
  userId: string;
  profileId: string | null;
  sajuChartId: string | null;
  personalityProfileId: string | null;
  scopeKey: string;
  reportType: SajuPersonalityReportType;
  lifeArea: SajuPersonalityLifeArea;
  scoreJson: SajuPersonalityScores | SajuPersonalityJsonObject;
  sajuFactsJson: SajuPersonalityFacts | SajuPersonalityJsonObject;
  personalityFactsJson: PersonalityFacts | SajuPersonalityJsonObject;
  fusionFactsJson: FusionFacts | SajuPersonalityJsonObject;
  reportJson: SajuPersonalityReport | SajuPersonalityJsonObject;
  productCode: string;
  paidAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSajuPersonalityReportInput {
  userId: string;
  profileId?: string | null;
  sajuChartId?: string | null;
  personalityProfileId?: string | null;
  scopeKey: string;
  reportType: SajuPersonalityReportType;
  lifeArea: SajuPersonalityLifeArea;
  scoreJson: SajuPersonalityScores | SajuPersonalityJsonObject;
  sajuFactsJson: SajuPersonalityFacts | SajuPersonalityJsonObject;
  personalityFactsJson: PersonalityFacts | SajuPersonalityJsonObject;
  fusionFactsJson: FusionFacts | SajuPersonalityJsonObject;
  reportJson: SajuPersonalityReport | SajuPersonalityJsonObject;
  productCode?: string;
  paidAmount?: number | null;
}
