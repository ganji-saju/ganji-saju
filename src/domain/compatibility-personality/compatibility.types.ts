import type {
  PersonalityAxisScores,
  PersonalityProfileSource,
  PersonalityTypeCode,
} from '@/domain/personality/personality.types';

export type CompatibilityRelationshipType =
  | 'dating'
  | 'marriage'
  | 'friendship'
  | 'family'
  | 'business';

export type CompatibilityScoreSource = 'saju' | 'personality' | 'question';

export type CompatibilityScoreAxis =
  | 'attractionScore'
  | 'stabilityScore'
  | 'communicationScore'
  | 'conflictRiskScore'
  | 'recoveryScore';

export interface CompatibilityAxisScores {
  attractionScore: number;
  stabilityScore: number;
  communicationScore: number;
  conflictRiskScore: number;
  recoveryScore: number;
}

export interface CompatibilityScores extends CompatibilityAxisScores {
  totalScore: number;
}

export interface CompatibilitySourceWeights {
  saju: number;
  personality: number;
  question: number;
}

export interface CompatibilityAxisFact {
  axis: CompatibilityScoreAxis;
  score: number;
  weight?: number;
  confidence?: number;
  key?: string;
  label?: string;
}

export interface CompatibilityFactGroup {
  axisFacts?: readonly CompatibilityAxisFact[];
}

export interface CompatibilitySajuFacts extends CompatibilityFactGroup {
  overallScore?: number;
  attractionScore?: number;
  stabilityScore?: number;
  communicationScore?: number;
  conflictRiskScore?: number;
  recoveryScore?: number;
  dayMasterHarmonyScore?: number;
  branchHarmonyScore?: number;
  elementBalanceScore?: number;
  currentFlowScore?: number;
  tensionRiskScore?: number;
  selfDayMaster?: string | null;
  partnerDayMaster?: string | null;
  sharedElements?: readonly string[];
  supportSignals?: readonly string[];
  tensionSignals?: readonly string[];
  raw?: Record<string, unknown>;
}

export interface CompatibilityPersonalityFacts
  extends CompatibilityFactGroup,
    Partial<CompatibilityAxisScores> {
  selfType?: PersonalityTypeCode | null;
  partnerType?: PersonalityTypeCode | null;
  selfSource?: PersonalityProfileSource;
  partnerSource?: PersonalityProfileSource;
  selfConfidence?: number;
  partnerConfidence?: number;
  selfAxisScores?: PersonalityAxisScores;
  partnerAxisScores?: PersonalityAxisScores;
  axisNotes?: Record<string, string>;
  raw?: Record<string, unknown>;
}

export interface CompatibilityQuestionFacts
  extends CompatibilityFactGroup,
    Partial<CompatibilityAxisScores> {
  clarityScore?: number;
  mutualIntentScore?: number;
  emotionalUrgencyScore?: number;
  topicSensitivityScore?: number;
  repairIntentScore?: number;
  raw?: Record<string, unknown>;
}

export interface NormalizedCompatibilityFacts {
  axisScores: CompatibilityAxisScores;
  facts: readonly CompatibilityAxisFact[];
}

export interface CompatibilityScoreAxisBreakdown {
  axis: CompatibilityScoreAxis;
  saju: number;
  personality: number;
  question: number;
  score: number;
}

export interface CompatibilityScoreInput {
  relationshipType: CompatibilityRelationshipType;
  sajuFacts?: CompatibilitySajuFacts;
  personalityFacts?: CompatibilityPersonalityFacts;
  questionFacts?: CompatibilityQuestionFacts;
}

export interface CompatibilityScoreResult extends CompatibilityScores {
  relationshipType: CompatibilityRelationshipType;
  weights: CompatibilitySourceWeights;
  sourceScores: Record<CompatibilityScoreSource, CompatibilityAxisScores>;
  breakdown: Record<CompatibilityScoreAxis, CompatibilityScoreAxisBreakdown>;
  conflictRiskMeaning: 'higher_means_more_conflict_risk';
}
