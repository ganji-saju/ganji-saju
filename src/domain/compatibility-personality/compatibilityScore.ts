import {
  COMPATIBILITY_SCORE_AXES,
  clampScore,
  normalizePersonalityFacts,
  normalizeQuestionFacts,
  normalizeSajuFacts,
} from './compatibilityFacts';
import type {
  CompatibilityAxisScores,
  CompatibilityScoreAxis,
  CompatibilityScoreAxisBreakdown,
  CompatibilityScoreInput,
  CompatibilityScoreResult,
  CompatibilityScoreSource,
} from './compatibility.types';
import { getScoreSourceWeights } from './scoreWeights';

export const CONFLICT_RISK_SCORE_MEANING = 'higher_means_more_conflict_risk' as const;

function calculateWeightedAxisScore(
  axis: CompatibilityScoreAxis,
  sourceScores: Record<CompatibilityScoreSource, CompatibilityAxisScores>,
  weights: CompatibilityScoreResult['weights']
): CompatibilityScoreAxisBreakdown {
  const saju = sourceScores.saju[axis];
  const personality = sourceScores.personality[axis];
  const question = sourceScores.question[axis];
  const score = clampScore(
    saju * weights.saju + personality * weights.personality + question * weights.question
  );

  return {
    axis,
    saju,
    personality,
    question,
    score,
  };
}

function calculateTotalScore(scores: CompatibilityAxisScores): number {
  const positiveConflictScore = 100 - scores.conflictRiskScore;
  return clampScore(
    (scores.attractionScore +
      scores.stabilityScore +
      scores.communicationScore +
      positiveConflictScore +
      scores.recoveryScore) /
      5
  );
}

export function calculateCompatibilityScore(
  input: CompatibilityScoreInput
): CompatibilityScoreResult {
  const weights = getScoreSourceWeights(input.relationshipType);
  const sourceScores: Record<CompatibilityScoreSource, CompatibilityAxisScores> = {
    saju: normalizeSajuFacts(input.sajuFacts).axisScores,
    personality: normalizePersonalityFacts(input.personalityFacts).axisScores,
    question: normalizeQuestionFacts(input.questionFacts).axisScores,
  };
  const breakdown = Object.fromEntries(
    COMPATIBILITY_SCORE_AXES.map((axis) => [
      axis,
      calculateWeightedAxisScore(axis, sourceScores, weights),
    ])
  ) as Record<CompatibilityScoreAxis, CompatibilityScoreAxisBreakdown>;
  const axisScores = Object.fromEntries(
    COMPATIBILITY_SCORE_AXES.map((axis) => [axis, breakdown[axis].score])
  ) as unknown as CompatibilityAxisScores;

  return {
    relationshipType: input.relationshipType,
    weights,
    sourceScores,
    breakdown,
    ...axisScores,
    totalScore: calculateTotalScore(axisScores),
    conflictRiskMeaning: CONFLICT_RISK_SCORE_MEANING,
  };
}
