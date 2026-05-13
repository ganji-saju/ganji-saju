import type { PersonalityAxis } from '@/domain/personality/personality.types';
import type {
  CompatibilityAxisFact,
  CompatibilityAxisScores,
  CompatibilityPersonalityFacts,
  CompatibilityQuestionFacts,
  CompatibilitySajuFacts,
  CompatibilityScoreAxis,
  NormalizedCompatibilityFacts,
} from './compatibility.types';

export const COMPATIBILITY_SCORE_AXES: readonly CompatibilityScoreAxis[] = [
  'attractionScore',
  'stabilityScore',
  'communicationScore',
  'conflictRiskScore',
  'recoveryScore',
];

export const DEFAULT_COMPATIBILITY_AXIS_SCORES: CompatibilityAxisScores = {
  attractionScore: 70,
  stabilityScore: 70,
  communicationScore: 70,
  conflictRiskScore: 35,
  recoveryScore: 70,
};

const PERSONALITY_AXES: readonly PersonalityAxis[] = ['IE', 'SN', 'TF', 'JP'];

export function clampScore(value: number, fallback = 70): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampUnit(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function inverseScore(score: number): number {
  return 100 - clampScore(score);
}

function makeFact(
  axis: CompatibilityScoreAxis,
  score: number,
  key: string,
  weight = 1,
  confidence = 1
): CompatibilityAxisFact {
  return {
    axis,
    score,
    key,
    weight,
    confidence,
  };
}

function addDirectAxisFacts(
  facts: CompatibilityAxisFact[],
  source: Partial<CompatibilityAxisScores>,
  keyPrefix: string,
  weight = 3
) {
  for (const axis of COMPATIBILITY_SCORE_AXES) {
    const score = source[axis];
    if (typeof score !== 'number') continue;

    facts.push(makeFact(axis, score, `${keyPrefix}.${axis}`, weight));
  }
}

function normalizeFacts(
  facts: readonly CompatibilityAxisFact[],
  defaults: CompatibilityAxisScores = DEFAULT_COMPATIBILITY_AXIS_SCORES
): NormalizedCompatibilityFacts {
  const axisScores = Object.fromEntries(
    COMPATIBILITY_SCORE_AXES.map((axis) => {
      let weightedTotal = 0;
      let totalWeight = 0;

      for (const fact of facts) {
        if (fact.axis !== axis) continue;

        const factWeight = Math.max(0, fact.weight ?? 1) * clampUnit(fact.confidence ?? 1);
        if (factWeight <= 0) continue;

        weightedTotal += clampScore(fact.score, defaults[axis]) * factWeight;
        totalWeight += factWeight;
      }

      const score = totalWeight > 0 ? weightedTotal / totalWeight : defaults[axis];
      return [axis, clampScore(score, defaults[axis])];
    })
  ) as unknown as CompatibilityAxisScores;

  return {
    axisScores,
    facts,
  };
}

export function normalizeSajuFacts(
  sajuFacts: CompatibilitySajuFacts | undefined
): NormalizedCompatibilityFacts {
  const facts: CompatibilityAxisFact[] = [...(sajuFacts?.axisFacts ?? [])];

  if (!sajuFacts) return normalizeFacts(facts);

  addDirectAxisFacts(facts, sajuFacts, 'saju.direct');

  if (typeof sajuFacts.overallScore === 'number') {
    const overall = clampScore(sajuFacts.overallScore);
    facts.push(makeFact('attractionScore', overall, 'saju.overall.attraction', 0.8));
    facts.push(makeFact('stabilityScore', overall, 'saju.overall.stability', 0.8));
    facts.push(makeFact('communicationScore', overall, 'saju.overall.communication', 0.6));
    facts.push(makeFact('recoveryScore', overall, 'saju.overall.recovery', 0.8));
    facts.push(makeFact('conflictRiskScore', inverseScore(overall), 'saju.overall.conflictRisk', 0.6));
  }

  if (typeof sajuFacts.dayMasterHarmonyScore === 'number') {
    const score = clampScore(sajuFacts.dayMasterHarmonyScore);
    facts.push(makeFact('attractionScore', score, 'saju.dayMasterHarmony.attraction', 1.4));
    facts.push(makeFact('stabilityScore', score, 'saju.dayMasterHarmony.stability', 0.8));
    facts.push(makeFact('conflictRiskScore', inverseScore(score), 'saju.dayMasterHarmony.conflictRisk', 0.6));
  }

  if (typeof sajuFacts.branchHarmonyScore === 'number') {
    const score = clampScore(sajuFacts.branchHarmonyScore);
    facts.push(makeFact('stabilityScore', score, 'saju.branchHarmony.stability', 1.3));
    facts.push(makeFact('recoveryScore', score, 'saju.branchHarmony.recovery', 1));
    facts.push(makeFact('conflictRiskScore', inverseScore(score), 'saju.branchHarmony.conflictRisk', 1.2));
  }

  if (typeof sajuFacts.elementBalanceScore === 'number') {
    const score = clampScore(sajuFacts.elementBalanceScore);
    facts.push(makeFact('stabilityScore', score, 'saju.elementBalance.stability', 1.2));
    facts.push(makeFact('recoveryScore', score, 'saju.elementBalance.recovery', 1));
  }

  if (typeof sajuFacts.currentFlowScore === 'number') {
    const score = clampScore(sajuFacts.currentFlowScore);
    facts.push(makeFact('communicationScore', score, 'saju.currentFlow.communication', 1));
    facts.push(makeFact('recoveryScore', score, 'saju.currentFlow.recovery', 0.8));
  }

  if (typeof sajuFacts.tensionRiskScore === 'number') {
    const risk = clampScore(sajuFacts.tensionRiskScore, DEFAULT_COMPATIBILITY_AXIS_SCORES.conflictRiskScore);
    facts.push(makeFact('conflictRiskScore', risk, 'saju.tensionRisk.conflictRisk', 1.5));
    facts.push(makeFact('stabilityScore', inverseScore(risk), 'saju.tensionRisk.stability', 0.7));
  }

  const supportCount = sajuFacts.supportSignals?.length ?? 0;
  if (supportCount > 0) {
    const score = clampScore(68 + Math.min(16, supportCount * 4));
    facts.push(makeFact('attractionScore', score, 'saju.supportSignals.attraction', 0.8));
    facts.push(makeFact('stabilityScore', score, 'saju.supportSignals.stability', 0.7));
    facts.push(makeFact('recoveryScore', score, 'saju.supportSignals.recovery', 0.7));
  }

  const sharedElementCount = sajuFacts.sharedElements?.length ?? 0;
  if (sharedElementCount > 0) {
    const score = clampScore(66 + Math.min(12, sharedElementCount * 3));
    facts.push(makeFact('stabilityScore', score, 'saju.sharedElements.stability', 0.6));
    facts.push(makeFact('communicationScore', score, 'saju.sharedElements.communication', 0.5));
  }

  const tensionCount = sajuFacts.tensionSignals?.length ?? 0;
  if (tensionCount > 0) {
    const risk = clampScore(35 + Math.min(50, tensionCount * 10), DEFAULT_COMPATIBILITY_AXIS_SCORES.conflictRiskScore);
    facts.push(makeFact('conflictRiskScore', risk, 'saju.tensionSignals.conflictRisk', 1));
    facts.push(makeFact('recoveryScore', inverseScore(risk), 'saju.tensionSignals.recovery', 0.5));
  }

  return normalizeFacts(facts);
}

function getTypeAxisPosition(
  typeCode: CompatibilityPersonalityFacts['selfType'],
  axis: PersonalityAxis
): number | null {
  if (!typeCode) return null;

  if (axis === 'IE') return typeCode[0] === 'E' ? 0.85 : -0.85;
  if (axis === 'SN') return typeCode[1] === 'N' ? 0.85 : -0.85;
  if (axis === 'TF') return typeCode[2] === 'F' ? 0.85 : -0.85;
  return typeCode[3] === 'P' ? 0.85 : -0.85;
}

function getAxisPosition(
  axisScores: CompatibilityPersonalityFacts['selfAxisScores'],
  typeCode: CompatibilityPersonalityFacts['selfType'],
  axis: PersonalityAxis
): number | null {
  const score = axisScores?.[axis];
  if (typeof score === 'number' && score !== 0) {
    return Math.max(-1, Math.min(1, score / 3));
  }

  return getTypeAxisPosition(typeCode, axis);
}

function getPersonalityConfidence(facts: CompatibilityPersonalityFacts): number {
  const explicit = [facts.selfConfidence, facts.partnerConfidence].filter(
    (value): value is number => typeof value === 'number'
  );

  if (explicit.length > 0) {
    return clampUnit(explicit.reduce((sum, value) => sum + value, 0) / explicit.length);
  }

  const sources = [facts.selfSource, facts.partnerSource].filter(Boolean);
  if (sources.includes('moonlight_check')) return 0.8;
  if (sources.includes('self_reported')) return 0.65;
  return 0.7;
}

export function normalizePersonalityFacts(
  personalityFacts: CompatibilityPersonalityFacts | undefined
): NormalizedCompatibilityFacts {
  const facts: CompatibilityAxisFact[] = [...(personalityFacts?.axisFacts ?? [])];

  if (!personalityFacts) return normalizeFacts(facts);

  addDirectAxisFacts(facts, personalityFacts, 'personality.direct');

  const positions = PERSONALITY_AXES.map((axis) => {
    const self = getAxisPosition(personalityFacts.selfAxisScores, personalityFacts.selfType, axis);
    const partner = getAxisPosition(
      personalityFacts.partnerAxisScores,
      personalityFacts.partnerType,
      axis
    );

    if (self === null || partner === null) return null;

    const gap = Math.abs(self - partner) / 2;
    return {
      axis,
      gap,
      similarity: 1 - gap,
    };
  });

  const resolvedPositions = positions.filter(
    (position): position is NonNullable<(typeof positions)[number]> => position !== null
  );

  if (resolvedPositions.length !== PERSONALITY_AXES.length) return normalizeFacts(facts);

  const byAxis = Object.fromEntries(
    resolvedPositions.map((position) => [position.axis, position])
  ) as Record<PersonalityAxis, NonNullable<(typeof positions)[number]>>;
  const confidence = getPersonalityConfidence(personalityFacts);
  const attraction =
    66 +
    byAxis.IE.gap * 7 +
    byAxis.SN.gap * 5 +
    byAxis.TF.similarity * 6 +
    byAxis.JP.gap * 3;
  const stability =
    56 +
    byAxis.JP.similarity * 16 +
    byAxis.TF.similarity * 10 +
    byAxis.SN.similarity * 6 +
    confidence * 4;
  const communication =
    54 +
    byAxis.IE.similarity * 8 +
    byAxis.SN.similarity * 12 +
    byAxis.TF.similarity * 14 +
    byAxis.JP.similarity * 4;
  const conflictRisk =
    24 +
    byAxis.TF.gap * 20 +
    byAxis.JP.gap * 16 +
    byAxis.SN.gap * 10 +
    byAxis.IE.gap * 6;
  const recovery =
    56 +
    byAxis.TF.similarity * 15 +
    byAxis.JP.similarity * 12 +
    byAxis.IE.similarity * 5 +
    confidence * 5;

  facts.push(makeFact('attractionScore', attraction, 'personality.axisPattern.attraction', 2, confidence));
  facts.push(makeFact('stabilityScore', stability, 'personality.axisPattern.stability', 2, confidence));
  facts.push(
    makeFact('communicationScore', communication, 'personality.axisPattern.communication', 2, confidence)
  );
  facts.push(
    makeFact('conflictRiskScore', conflictRisk, 'personality.axisPattern.conflictRisk', 2, confidence)
  );
  facts.push(makeFact('recoveryScore', recovery, 'personality.axisPattern.recovery', 2, confidence));

  return normalizeFacts(facts);
}

export function normalizeQuestionFacts(
  questionFacts: CompatibilityQuestionFacts | undefined
): NormalizedCompatibilityFacts {
  const facts: CompatibilityAxisFact[] = [...(questionFacts?.axisFacts ?? [])];

  if (!questionFacts) return normalizeFacts(facts);

  addDirectAxisFacts(facts, questionFacts, 'question.direct', 2.5);

  if (typeof questionFacts.clarityScore === 'number') {
    const score = clampScore(questionFacts.clarityScore);
    facts.push(makeFact('communicationScore', score, 'question.clarity.communication', 1.2));
    facts.push(makeFact('stabilityScore', score, 'question.clarity.stability', 0.5));
  }

  if (typeof questionFacts.mutualIntentScore === 'number') {
    const score = clampScore(questionFacts.mutualIntentScore);
    facts.push(makeFact('attractionScore', score, 'question.mutualIntent.attraction', 1));
    facts.push(makeFact('stabilityScore', score, 'question.mutualIntent.stability', 1));
    facts.push(makeFact('recoveryScore', score, 'question.mutualIntent.recovery', 1));
    facts.push(makeFact('conflictRiskScore', inverseScore(score), 'question.mutualIntent.conflictRisk', 0.7));
  }

  if (typeof questionFacts.emotionalUrgencyScore === 'number') {
    const risk = clampScore(
      questionFacts.emotionalUrgencyScore,
      DEFAULT_COMPATIBILITY_AXIS_SCORES.conflictRiskScore
    );
    facts.push(makeFact('conflictRiskScore', risk, 'question.emotionalUrgency.conflictRisk', 1));
    facts.push(makeFact('stabilityScore', inverseScore(risk), 'question.emotionalUrgency.stability', 0.5));
  }

  if (typeof questionFacts.topicSensitivityScore === 'number') {
    const risk = clampScore(
      questionFacts.topicSensitivityScore,
      DEFAULT_COMPATIBILITY_AXIS_SCORES.conflictRiskScore
    );
    facts.push(makeFact('conflictRiskScore', risk, 'question.topicSensitivity.conflictRisk', 1));
    facts.push(makeFact('communicationScore', inverseScore(risk), 'question.topicSensitivity.communication', 0.4));
  }

  if (typeof questionFacts.repairIntentScore === 'number') {
    const score = clampScore(questionFacts.repairIntentScore);
    facts.push(makeFact('recoveryScore', score, 'question.repairIntent.recovery', 1.2));
    facts.push(makeFact('communicationScore', score, 'question.repairIntent.communication', 0.8));
    facts.push(makeFact('conflictRiskScore', inverseScore(score), 'question.repairIntent.conflictRisk', 0.5));
  }

  return normalizeFacts(facts);
}
