import type {
  CompatibilityRelationshipType,
  CompatibilitySourceWeights,
} from './compatibility.types';

export const SCORE_SOURCE_WEIGHTS: Record<
  CompatibilityRelationshipType,
  CompatibilitySourceWeights
> = {
  dating: {
    saju: 0.45,
    personality: 0.35,
    question: 0.2,
  },
  marriage: {
    saju: 0.55,
    personality: 0.25,
    question: 0.2,
  },
  friendship: {
    saju: 0.35,
    personality: 0.45,
    question: 0.2,
  },
  family: {
    saju: 0.6,
    personality: 0.2,
    question: 0.2,
  },
  business: {
    saju: 0.4,
    personality: 0.4,
    question: 0.2,
  },
};

export function getScoreSourceWeights(
  relationshipType: CompatibilityRelationshipType
): CompatibilitySourceWeights {
  return SCORE_SOURCE_WEIGHTS[relationshipType];
}
