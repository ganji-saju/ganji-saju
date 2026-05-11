import assert from 'node:assert/strict';
import {
  calculateSajuPersonalityScore,
  SAJU_PERSONALITY_SCORE_AXES,
  SAJU_PERSONALITY_SCORE_WEIGHTS,
} from '@/domain/saju-personality';
import type {
  FusionFacts,
  PersonalityFacts,
  SajuPersonalityFactSignal,
  SajuPersonalityFusionPattern,
  SajuPersonalityFusionPatternKey,
  SajuPersonalityScoreAxis,
  SajuPersonalityFacts,
} from '@/domain/saju-personality';

declare const test: (name: string, fn: () => void) => void;

function signal(
  key: string,
  source: SajuPersonalityFactSignal['source'],
  confidence = 0.86
): SajuPersonalityFactSignal {
  return {
    key,
    label: key,
    description: `${key} signal`,
    source,
    confidence,
  };
}

function pattern(
  key: SajuPersonalityFusionPatternKey,
  signals: readonly SajuPersonalityFactSignal[],
  confidence = 0.86
): SajuPersonalityFusionPattern {
  return {
    key,
    title: key,
    summary: `${key} summary`,
    signals,
    actionHint: `${key} action`,
    confidence,
  };
}

const strongSajuFacts: SajuPersonalityFacts = {
  chartVersion: 'saju-data/v1',
  dayMaster: '甲',
  primaryElements: ['목', '수'],
  supportiveElements: ['수', '화'],
  tensionElements: ['금'],
  seasonalTone: '卯월의 계절감',
  strengthSignals: [
    signal('saju:day-master', 'saju', 0.92),
    signal('saju:dominant', 'saju', 0.88),
    signal('saju:strength', 'saju', 0.82),
    signal('saju:yongsin', 'saju', 0.8),
  ],
  timingSignals: [signal('saju:timing:1', 'saju', 0.78)],
  cautionSignals: [signal('saju:weakest', 'saju', 0.74)],
};

const strongPersonalityFacts: PersonalityFacts = {
  typeCode: 'ENFJ',
  source: 'moonlight_check',
  confidence: 0.9,
  axisScores: {
    IE: 3,
    SN: 3,
    TF: 3,
    JP: -3,
  },
  preferenceSignals: [
    signal('personality:energy', 'personality', 0.9),
    signal('personality:expression', 'personality', 0.9),
    signal('personality:decision', 'personality', 0.88),
    signal('personality:execution', 'personality', 0.86),
    signal('personality:relationship', 'personality', 0.84),
  ],
  cautionSignals: [signal('personality:caution:type', 'personality', 0.82)],
};

const strongFusionFacts: FusionFacts = {
  lifeArea: 'work',
  energyPattern: pattern('energyPattern', [
    signal('saju:day-master', 'saju', 0.9),
    signal('personality:energy', 'personality', 0.9),
  ]),
  expressionPattern: pattern('expressionPattern', [
    signal('saju:day-master', 'saju', 0.9),
    signal('personality:expression', 'personality', 0.9),
  ]),
  decisionPattern: pattern('decisionPattern', [
    signal('saju:dominant', 'saju', 0.86),
    signal('personality:decision', 'personality', 0.88),
  ]),
  executionPattern: pattern('executionPattern', [
    signal('saju:timing:1', 'saju', 0.8),
    signal('personality:execution', 'personality', 0.86),
  ]),
  relationshipPattern: pattern('relationshipPattern', [
    signal('saju:strength', 'saju', 0.82),
    signal('personality:relationship', 'personality', 0.84),
  ]),
  growthPattern: pattern('growthPattern', [
    signal('fusion:growth-focus', 'fusion', 0.86),
    signal('saju:yongsin', 'saju', 0.8),
  ]),
  cautionPattern: pattern('cautionPattern', [
    signal('saju:weakest', 'saju', 0.74),
    signal('personality:caution:type', 'personality', 0.82),
  ]),
  strongestAxis: 'executionRhythmScore',
  lowestAxis: 'decisionScore',
  alignmentSignals: [
    signal('saju:day-master', 'saju', 0.9),
    signal('personality:energy', 'personality', 0.9),
  ],
  frictionSignals: [signal('personality:caution:type', 'personality', 0.82)],
  growthSignals: [signal('fusion:growth-focus', 'fusion', 0.86)],
};

function sparseFusionFacts(confidence = 0.2): FusionFacts {
  const emptyPattern = (key: SajuPersonalityFusionPatternKey) =>
    pattern(key, [], confidence);

  return {
    lifeArea: 'basic',
    energyPattern: emptyPattern('energyPattern'),
    expressionPattern: emptyPattern('expressionPattern'),
    decisionPattern: emptyPattern('decisionPattern'),
    executionPattern: emptyPattern('executionPattern'),
    relationshipPattern: emptyPattern('relationshipPattern'),
    growthPattern: emptyPattern('growthPattern'),
    cautionPattern: emptyPattern('cautionPattern'),
    alignmentSignals: [],
    frictionSignals: [],
    growthSignals: [],
  };
}

test('saju personality score weights cover every personal six-axis score', () => {
  assert.deepEqual(Object.keys(SAJU_PERSONALITY_SCORE_WEIGHTS).sort(), [...SAJU_PERSONALITY_SCORE_AXES].sort());

  for (const axis of SAJU_PERSONALITY_SCORE_AXES) {
    const weights = SAJU_PERSONALITY_SCORE_WEIGHTS[axis];
    assert.equal(Number((weights.saju + weights.personality + weights.fusion).toFixed(2)), 1);
  }
});

test('calculateSajuPersonalityScore returns normalized personal six-axis scores', () => {
  const result = calculateSajuPersonalityScore({
    sajuFacts: strongSajuFacts,
    personalityFacts: strongPersonalityFacts,
    fusionFacts: strongFusionFacts,
  });

  const scoreAxes: readonly SajuPersonalityScoreAxis[] = [
    'innerEnergyScore',
    'expressionScore',
    'decisionScore',
    'executionRhythmScore',
    'relationshipSensitivityScore',
    'growthDirectionScore',
  ];

  for (const axis of scoreAxes) {
    assert.ok(result[axis] >= 0);
    assert.ok(result[axis] <= 100);
    assert.equal(result.breakdown[axis].axis, axis);
  }

  assert.ok(result.totalClarityScore >= 0);
  assert.ok(result.totalClarityScore <= 100);
  assert.equal(result.scoreMeaning, 'higher_means_clearer_trait_signal_not_better_or_worse');
  assert.equal(
    result.totalClarityMeaning,
    'higher_means_saju_and_personality_facts_point_in_a_more_consistent_direction'
  );
  assert.equal('attractionScore' in result, false);
  assert.equal('conflictRiskScore' in result, false);
});

test('totalClarityScore rises when saju, personality, and fusion facts are more consistent', () => {
  const strong = calculateSajuPersonalityScore({
    sajuFacts: strongSajuFacts,
    personalityFacts: strongPersonalityFacts,
    fusionFacts: strongFusionFacts,
  });
  const sparse = calculateSajuPersonalityScore({
    sajuFacts: {
      primaryElements: [],
      supportiveElements: [],
      tensionElements: [],
      strengthSignals: [],
      timingSignals: [],
      cautionSignals: [],
    },
    personalityFacts: {
      confidence: 0.1,
      preferenceSignals: [],
      cautionSignals: [],
    },
    fusionFacts: sparseFusionFacts(),
  });

  assert.ok(strong.totalClarityScore > sparse.totalClarityScore);
});

test('calculateSajuPersonalityScore clamps unusual confidence values to 0 through 100', () => {
  const result = calculateSajuPersonalityScore({
    sajuFacts: {
      ...strongSajuFacts,
      strengthSignals: [signal('saju:day-master', 'saju', 2)],
      cautionSignals: [signal('saju:weakest', 'saju', -1)],
    },
    personalityFacts: {
      ...strongPersonalityFacts,
      confidence: 2,
      preferenceSignals: [signal('personality:energy', 'personality', 2)],
    },
    fusionFacts: sparseFusionFacts(2),
  });

  for (const axis of SAJU_PERSONALITY_SCORE_AXES) {
    assert.ok(result[axis] >= 0);
    assert.ok(result[axis] <= 100);
  }
  assert.ok(result.totalClarityScore >= 0);
  assert.ok(result.totalClarityScore <= 100);
});
