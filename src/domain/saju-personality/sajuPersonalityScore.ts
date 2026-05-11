import {
  SAJU_PERSONALITY_AXIS_PATTERN_MAP,
  SAJU_PERSONALITY_SCORE_WEIGHTS,
  type SajuPersonalityScoreSource,
} from './scoreWeights';
import type {
  FusionFacts,
  PersonalityFacts,
  SajuPersonalityFactSignal,
  SajuPersonalityFusionPattern,
  SajuPersonalityScoreAxis,
  SajuPersonalityScores,
  SajuPersonalityFacts,
} from './sajuPersonality.types';
import { SAJU_PERSONALITY_SCORE_AXES } from './sajuPersonality.types';

export type SajuPersonalityAxisScores = Record<SajuPersonalityScoreAxis, number>;

export interface SajuPersonalityScoreInput {
  sajuFacts: SajuPersonalityFacts;
  personalityFacts: PersonalityFacts;
  fusionFacts: FusionFacts;
}

export interface SajuPersonalityAxisBreakdown {
  axis: SajuPersonalityScoreAxis;
  saju: number;
  personality: number;
  fusion: number;
  score: number;
}

export interface SajuPersonalityScoreResult extends SajuPersonalityScores {
  sourceScores: Record<SajuPersonalityScoreSource, SajuPersonalityAxisScores>;
  breakdown: Record<SajuPersonalityScoreAxis, SajuPersonalityAxisBreakdown>;
}

type WeightedScorePart = readonly [score: number, weight: number];

export function calculateSajuPersonalityScore(
  input: SajuPersonalityScoreInput
): SajuPersonalityScoreResult {
  const sourceScores: Record<SajuPersonalityScoreSource, SajuPersonalityAxisScores> = {
    saju: buildSajuSourceScores(input.sajuFacts),
    personality: buildPersonalitySourceScores(input.personalityFacts),
    fusion: buildFusionSourceScores(input.fusionFacts),
  };

  const axisScores = Object.fromEntries(
    SAJU_PERSONALITY_SCORE_AXES.map((axis) => {
      const weights = SAJU_PERSONALITY_SCORE_WEIGHTS[axis];
      const score = weightedAverage([
        [sourceScores.saju[axis], weights.saju],
        [sourceScores.personality[axis], weights.personality],
        [sourceScores.fusion[axis], weights.fusion],
      ]);

      return [axis, normalizeScore(score)];
    })
  ) as SajuPersonalityAxisScores;

  const breakdown = Object.fromEntries(
    SAJU_PERSONALITY_SCORE_AXES.map((axis) => [
      axis,
      {
        axis,
        saju: sourceScores.saju[axis],
        personality: sourceScores.personality[axis],
        fusion: sourceScores.fusion[axis],
        score: axisScores[axis],
      },
    ])
  ) as Record<SajuPersonalityScoreAxis, SajuPersonalityAxisBreakdown>;

  return {
    ...axisScores,
    totalClarityScore: calculateTotalClarityScore(input, sourceScores),
    scoreScale: '0-100',
    scoreMeaning: 'higher_means_clearer_trait_signal_not_better_or_worse',
    totalClarityMeaning:
      'higher_means_saju_and_personality_facts_point_in_a_more_consistent_direction',
    sourceScores,
    breakdown,
  };
}

function buildSajuSourceScores(sajuFacts: SajuPersonalityFacts): SajuPersonalityAxisScores {
  const strengthScore = scoreSignals(sajuFacts.strengthSignals);
  const timingScore = scoreSignals(sajuFacts.timingSignals);
  const cautionScore = scoreSignals(sajuFacts.cautionSignals);
  const elementScore = scoreElementCoverage(sajuFacts);
  const dayMasterScore = scoreSpecificSignal(sajuFacts.strengthSignals, 'saju:day-master');
  const dominantScore = scoreSpecificSignal(sajuFacts.strengthSignals, 'saju:dominant');
  const yongsinScore = scoreSpecificSignal(sajuFacts.strengthSignals, 'saju:yongsin');
  const unknownHourPenalty = hasSignal(sajuFacts.cautionSignals, 'saju:unknown-hour') ? 6 : 0;

  return {
    innerEnergyScore: normalizeScore(
      weightedAverage([
        [strengthScore, 0.4],
        [elementScore, 0.25],
        [dayMasterScore, 0.25],
        [cautionScore, 0.1],
      ])
    ),
    expressionScore: normalizeScore(
      weightedAverage([
        [dayMasterScore, 0.45],
        [dominantScore, 0.25],
        [strengthScore, 0.2],
        [elementScore, 0.1],
      ])
    ),
    decisionScore: normalizeScore(
      weightedAverage([
        [dominantScore, 0.3],
        [yongsinScore, 0.3],
        [elementScore, 0.2],
        [strengthScore, 0.2],
      ])
    ),
    executionRhythmScore: normalizeScore(
      weightedAverage([
        [timingScore - unknownHourPenalty, 0.45],
        [strengthScore, 0.25],
        [yongsinScore, 0.2],
        [cautionScore, 0.1],
      ])
    ),
    relationshipSensitivityScore: normalizeScore(
      weightedAverage([
        [dayMasterScore, 0.3],
        [strengthScore, 0.25],
        [cautionScore, 0.25],
        [elementScore, 0.2],
      ])
    ),
    growthDirectionScore: normalizeScore(
      weightedAverage([
        [timingScore, 0.35],
        [yongsinScore, 0.3],
        [cautionScore, 0.2],
        [elementScore, 0.15],
      ])
    ),
  };
}

function buildPersonalitySourceScores(
  personalityFacts: PersonalityFacts
): SajuPersonalityAxisScores {
  const confidenceScore = normalizeScore((personalityFacts.confidence ?? 0.55) * 100);
  const typeScore = personalityFacts.typeCode ? 78 : 50;
  const preferenceScore = scoreSignals(personalityFacts.preferenceSignals);
  const cautionScore = scoreSignals(personalityFacts.cautionSignals);
  const energySignalScore = scoreSpecificSignal(
    personalityFacts.preferenceSignals,
    'personality:energy'
  );
  const expressionSignalScore = scoreSpecificSignal(
    personalityFacts.preferenceSignals,
    'personality:expression'
  );
  const decisionSignalScore = scoreSpecificSignal(
    personalityFacts.preferenceSignals,
    'personality:decision'
  );
  const executionSignalScore = scoreSpecificSignal(
    personalityFacts.preferenceSignals,
    'personality:execution'
  );
  const relationshipSignalScore = scoreSpecificSignal(
    personalityFacts.preferenceSignals,
    'personality:relationship'
  );

  return {
    innerEnergyScore: normalizeScore(
      weightedAverage([
        [scoreAxisClarity(personalityFacts.axisScores, 'IE'), 0.45],
        [energySignalScore, 0.3],
        [confidenceScore, 0.25],
      ])
    ),
    expressionScore: normalizeScore(
      weightedAverage([
        [expressionSignalScore, 0.4],
        [typeScore, 0.2],
        [scoreAxisClarity(personalityFacts.axisScores, 'IE'), 0.15],
        [scoreAxisClarity(personalityFacts.axisScores, 'TF'), 0.15],
        [confidenceScore, 0.1],
      ])
    ),
    decisionScore: normalizeScore(
      weightedAverage([
        [decisionSignalScore, 0.4],
        [scoreAxisClarity(personalityFacts.axisScores, 'SN'), 0.25],
        [scoreAxisClarity(personalityFacts.axisScores, 'TF'), 0.25],
        [confidenceScore, 0.1],
      ])
    ),
    executionRhythmScore: normalizeScore(
      weightedAverage([
        [executionSignalScore, 0.4],
        [scoreAxisClarity(personalityFacts.axisScores, 'JP'), 0.35],
        [preferenceScore, 0.15],
        [confidenceScore, 0.1],
      ])
    ),
    relationshipSensitivityScore: normalizeScore(
      weightedAverage([
        [relationshipSignalScore, 0.35],
        [scoreAxisClarity(personalityFacts.axisScores, 'IE'), 0.2],
        [scoreAxisClarity(personalityFacts.axisScores, 'TF'), 0.2],
        [cautionScore, 0.15],
        [confidenceScore, 0.1],
      ])
    ),
    growthDirectionScore: normalizeScore(
      weightedAverage([
        [averageAxisClarity(personalityFacts.axisScores), 0.35],
        [preferenceScore, 0.25],
        [cautionScore, 0.2],
        [confidenceScore, 0.2],
      ])
    ),
  };
}

function buildFusionSourceScores(fusionFacts: FusionFacts): SajuPersonalityAxisScores {
  return Object.fromEntries(
    SAJU_PERSONALITY_SCORE_AXES.map((axis) => {
      const patternKey = SAJU_PERSONALITY_AXIS_PATTERN_MAP[axis];
      return [axis, scorePattern(fusionFacts[patternKey])];
    })
  ) as SajuPersonalityAxisScores;
}

function calculateTotalClarityScore(
  input: SajuPersonalityScoreInput,
  sourceScores: Record<SajuPersonalityScoreSource, SajuPersonalityAxisScores>
): number {
  const sourceConsistency = average(
    SAJU_PERSONALITY_SCORE_AXES.map((axis) =>
      normalizeScore(100 - Math.abs(sourceScores.saju[axis] - sourceScores.personality[axis]) * 0.75)
    )
  );
  const fusionBridge = average(
    SAJU_PERSONALITY_SCORE_AXES.map((axis) => {
      const sourceAverage = (sourceScores.saju[axis] + sourceScores.personality[axis]) / 2;
      return normalizeScore(100 - Math.abs(sourceScores.fusion[axis] - sourceAverage) * 0.7);
    })
  );
  const patternConfidence = average([
    scorePattern(input.fusionFacts.energyPattern),
    scorePattern(input.fusionFacts.expressionPattern),
    scorePattern(input.fusionFacts.decisionPattern),
    scorePattern(input.fusionFacts.executionPattern),
    scorePattern(input.fusionFacts.relationshipPattern),
    scorePattern(input.fusionFacts.growthPattern),
    scorePattern(input.fusionFacts.cautionPattern),
  ]);
  const evidenceCoverage = calculateEvidenceCoverage(input);

  return normalizeScore(
    weightedAverage([
      [sourceConsistency, 0.35],
      [fusionBridge, 0.25],
      [patternConfidence, 0.25],
      [evidenceCoverage, 0.15],
    ])
  );
}

function calculateEvidenceCoverage(input: SajuPersonalityScoreInput): number {
  const covered = [
    Boolean(input.sajuFacts.strengthSignals?.length),
    Boolean(input.sajuFacts.timingSignals?.length),
    Boolean(input.sajuFacts.cautionSignals?.length),
    Boolean(input.personalityFacts.preferenceSignals?.length),
    Boolean(input.personalityFacts.cautionSignals?.length),
    Boolean(input.fusionFacts.alignmentSignals?.length),
    Boolean(input.fusionFacts.frictionSignals?.length),
    Boolean(input.fusionFacts.growthSignals?.length),
  ].filter(Boolean).length;

  return normalizeScore((covered / 8) * 100);
}

function scorePattern(pattern: SajuPersonalityFusionPattern): number {
  const confidenceScore = normalizeScore((pattern.confidence ?? 0.6) * 100);
  const signalScore = scoreSignals(pattern.signals);
  const contentScore = 50 + (pattern.summary ? 16 : 0) + (pattern.actionHint ? 12 : 0);

  return normalizeScore(
    weightedAverage([
      [confidenceScore, 0.45],
      [signalScore, 0.4],
      [contentScore, 0.15],
    ])
  );
}

function scoreSpecificSignal(
  signals: readonly SajuPersonalityFactSignal[] | undefined,
  keyPrefix: string
): number {
  const signal = signals?.find((item) => item.key.startsWith(keyPrefix));
  if (!signal) return 50;
  return scoreSignals([signal]);
}

function scoreSignals(signals: readonly SajuPersonalityFactSignal[] | undefined): number {
  if (!signals?.length) return 45;

  const averageConfidence = average(
    signals.map((signal) => normalizeScore((signal.confidence ?? 0.65) * 100))
  );
  const richnessBonus = Math.min(12, signals.length * 4);
  const weightBonus = Math.min(
    8,
    signals.reduce((sum, signal) => sum + Math.max(0, signal.weight ?? 0), 0) * 2
  );

  return normalizeScore(averageConfidence * 0.88 + richnessBonus + weightBonus);
}

function scoreElementCoverage(sajuFacts: SajuPersonalityFacts): number {
  const uniqueElements = new Set([
    ...(sajuFacts.primaryElements ?? []),
    ...(sajuFacts.supportiveElements ?? []),
    ...(sajuFacts.tensionElements ?? []),
  ]);

  return normalizeScore(
    48 +
      Math.min(24, uniqueElements.size * 6) +
      (sajuFacts.dayMaster ? 8 : 0) +
      (sajuFacts.seasonalTone ? 5 : 0) +
      (sajuFacts.chartVersion ? 5 : 0)
  );
}

function scoreAxisClarity(
  axisScores: PersonalityFacts['axisScores'],
  axis: keyof NonNullable<PersonalityFacts['axisScores']>
): number {
  const score = axisScores?.[axis];
  if (typeof score !== 'number') return 50;
  return normalizeScore(55 + Math.min(35, Math.abs(score) * 11.67));
}

function averageAxisClarity(axisScores: PersonalityFacts['axisScores']): number {
  return average([
    scoreAxisClarity(axisScores, 'IE'),
    scoreAxisClarity(axisScores, 'SN'),
    scoreAxisClarity(axisScores, 'TF'),
    scoreAxisClarity(axisScores, 'JP'),
  ]);
}

function hasSignal(
  signals: readonly SajuPersonalityFactSignal[] | undefined,
  keyPrefix: string
): boolean {
  return signals?.some((signal) => signal.key.startsWith(keyPrefix)) ?? false;
}

function weightedAverage(parts: readonly WeightedScorePart[]): number {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return 0;
  const weightedSum = parts.reduce((sum, [score, weight]) => sum + normalizeScore(score) * weight, 0);
  return weightedSum / totalWeight;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
