import assert from 'node:assert/strict';
import { calculateCompatibilityScore } from './compatibilityScore';
import { SCORE_SOURCE_WEIGHTS } from './scoreWeights';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('personality compatibility score weights match relationship policy', () => {
  assert.deepEqual(SCORE_SOURCE_WEIGHTS.dating, {
    saju: 0.45,
    personality: 0.35,
    question: 0.2,
  });
  assert.deepEqual(SCORE_SOURCE_WEIGHTS.marriage, {
    saju: 0.55,
    personality: 0.25,
    question: 0.2,
  });
  assert.deepEqual(SCORE_SOURCE_WEIGHTS.friendship, {
    saju: 0.35,
    personality: 0.45,
    question: 0.2,
  });
  assert.deepEqual(SCORE_SOURCE_WEIGHTS.family, {
    saju: 0.6,
    personality: 0.2,
    question: 0.2,
  });
  assert.deepEqual(SCORE_SOURCE_WEIGHTS.business, {
    saju: 0.4,
    personality: 0.4,
    question: 0.2,
  });

  for (const weights of Object.values(SCORE_SOURCE_WEIGHTS)) {
    assert.ok(Math.abs(weights.saju + weights.personality + weights.question - 1) < 0.0001);
  }
});

test('personality compatibility score returns normalized five-axis result', () => {
  const result = calculateCompatibilityScore({
    relationshipType: 'dating',
    sajuFacts: {
      overallScore: 82,
      dayMasterHarmonyScore: 86,
      branchHarmonyScore: 78,
      elementBalanceScore: 74,
      tensionRiskScore: 24,
      supportSignals: ['stem-combination'],
      sharedElements: ['wood'],
    },
    personalityFacts: {
      selfType: 'ENFJ',
      partnerType: 'INFP',
      selfConfidence: 0.92,
      partnerConfidence: 0.84,
    },
    questionFacts: {
      clarityScore: 74,
      mutualIntentScore: 84,
      emotionalUrgencyScore: 28,
      topicSensitivityScore: 24,
      repairIntentScore: 88,
    },
  });

  assert.equal(result.relationshipType, 'dating');
  assert.equal(result.conflictRiskMeaning, 'higher_means_more_conflict_risk');
  assert.deepEqual(Object.keys(result.breakdown), [
    'attractionScore',
    'stabilityScore',
    'communicationScore',
    'conflictRiskScore',
    'recoveryScore',
  ]);

  for (const score of [
    result.attractionScore,
    result.stabilityScore,
    result.communicationScore,
    result.conflictRiskScore,
    result.recoveryScore,
    result.totalScore,
  ]) {
    assert.ok(score >= 0 && score <= 100);
  }
});

test('conflictRiskScore is higher when risk facts are stronger and lowers totalScore', () => {
  const calm = calculateCompatibilityScore({
    relationshipType: 'marriage',
    sajuFacts: {
      overallScore: 82,
      tensionRiskScore: 18,
      supportSignals: ['branch-harmony', 'element-support'],
    },
    personalityFacts: {
      selfType: 'ISFJ',
      partnerType: 'ISFJ',
      selfConfidence: 0.9,
      partnerConfidence: 0.9,
    },
    questionFacts: {
      clarityScore: 82,
      mutualIntentScore: 86,
      topicSensitivityScore: 20,
      repairIntentScore: 84,
    },
  });
  const tense = calculateCompatibilityScore({
    relationshipType: 'marriage',
    sajuFacts: {
      overallScore: 48,
      tensionRiskScore: 92,
      tensionSignals: ['branch-clash', 'harm', 'punishment'],
    },
    personalityFacts: {
      selfType: 'ENTJ',
      partnerType: 'ISFP',
      selfConfidence: 0.9,
      partnerConfidence: 0.9,
    },
    questionFacts: {
      clarityScore: 34,
      mutualIntentScore: 42,
      emotionalUrgencyScore: 88,
      topicSensitivityScore: 90,
      repairIntentScore: 36,
    },
  });

  assert.ok(tense.conflictRiskScore > calm.conflictRiskScore);
  assert.ok(tense.totalScore < calm.totalScore);
});

test('relationship type changes source influence without mutating facts', () => {
  const sajuFacts = {
    attractionScore: 92,
    stabilityScore: 90,
    communicationScore: 88,
    conflictRiskScore: 12,
    recoveryScore: 86,
  };
  const personalityFacts = {
    attractionScore: 42,
    stabilityScore: 38,
    communicationScore: 40,
    conflictRiskScore: 82,
    recoveryScore: 36,
  };
  const questionFacts = {
    attractionScore: 70,
    stabilityScore: 70,
    communicationScore: 70,
    conflictRiskScore: 35,
    recoveryScore: 70,
  };

  const marriage = calculateCompatibilityScore({
    relationshipType: 'marriage',
    sajuFacts,
    personalityFacts,
    questionFacts,
  });
  const friendship = calculateCompatibilityScore({
    relationshipType: 'friendship',
    sajuFacts,
    personalityFacts,
    questionFacts,
  });

  assert.ok(marriage.totalScore > friendship.totalScore);
  assert.ok(marriage.attractionScore > friendship.attractionScore);
  assert.ok(marriage.conflictRiskScore < friendship.conflictRiskScore);
});

test('score engine clamps out-of-range fact scores to 0 through 100', () => {
  const result = calculateCompatibilityScore({
    relationshipType: 'business',
    sajuFacts: {
      attractionScore: 140,
      stabilityScore: 130,
      communicationScore: 120,
      conflictRiskScore: -20,
      recoveryScore: 101,
    },
    personalityFacts: {
      attractionScore: -10,
      stabilityScore: -30,
      communicationScore: 0,
      conflictRiskScore: 130,
      recoveryScore: -50,
    },
    questionFacts: {
      clarityScore: 200,
      mutualIntentScore: 160,
      emotionalUrgencyScore: -40,
      topicSensitivityScore: -30,
      repairIntentScore: 180,
    },
  });

  assert.ok(result.attractionScore >= 0 && result.attractionScore <= 100);
  assert.ok(result.stabilityScore >= 0 && result.stabilityScore <= 100);
  assert.ok(result.communicationScore >= 0 && result.communicationScore <= 100);
  assert.ok(result.conflictRiskScore >= 0 && result.conflictRiskScore <= 100);
  assert.ok(result.recoveryScore >= 0 && result.recoveryScore <= 100);
  assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
});
