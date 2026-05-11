import type {
  SajuPersonalityFusionPatternKey,
  SajuPersonalityScoreAxis,
} from './sajuPersonality.types';

export type SajuPersonalityScoreSource = 'saju' | 'personality' | 'fusion';

export type SajuPersonalitySourceWeights = Record<SajuPersonalityScoreSource, number>;

export const SAJU_PERSONALITY_SCORE_WEIGHTS: Record<
  SajuPersonalityScoreAxis,
  SajuPersonalitySourceWeights
> = {
  innerEnergyScore: {
    saju: 0.45,
    personality: 0.25,
    fusion: 0.3,
  },
  expressionScore: {
    saju: 0.25,
    personality: 0.45,
    fusion: 0.3,
  },
  decisionScore: {
    saju: 0.25,
    personality: 0.45,
    fusion: 0.3,
  },
  executionRhythmScore: {
    saju: 0.3,
    personality: 0.3,
    fusion: 0.4,
  },
  relationshipSensitivityScore: {
    saju: 0.2,
    personality: 0.5,
    fusion: 0.3,
  },
  growthDirectionScore: {
    saju: 0.35,
    personality: 0.2,
    fusion: 0.45,
  },
};

export const SAJU_PERSONALITY_AXIS_PATTERN_MAP: Record<
  SajuPersonalityScoreAxis,
  SajuPersonalityFusionPatternKey
> = {
  innerEnergyScore: 'energyPattern',
  expressionScore: 'expressionPattern',
  decisionScore: 'decisionPattern',
  executionRhythmScore: 'executionPattern',
  relationshipSensitivityScore: 'relationshipPattern',
  growthDirectionScore: 'growthPattern',
};
