import type {
  PersonalityAxisScores,
  PersonalityCheckAnswer,
  PersonalityProfileSource,
  PersonalityTypeCode,
} from '@/domain/personality/personality.types';
import type { CompatibilityRelationshipType } from '@/domain/compatibility-personality';
import type { BirthInput } from '@/lib/saju/types';

export const PERSONALITY_COMPATIBILITY_INPUT_SESSION_KEY =
  'moonlight-personality-compatibility-input-v1';

export type PersonalityCompatibilityQuestionKey =
  | 'fit'
  | 'conflict'
  | 'heart'
  | 'recovery'
  | 'timing'
  | 'long_term';

export interface PersonalityCompatibilityInputPerson {
  name: string;
  birthInput: BirthInput;
  birthSummary: string;
  personality: {
    typeCode: PersonalityTypeCode;
    source: PersonalityProfileSource;
    confidence: number;
    axisScores?: PersonalityAxisScores;
    answers?: readonly PersonalityCheckAnswer[];
  };
}

export interface PersonalityCompatibilityInputPayload {
  version: 1;
  relationshipType: CompatibilityRelationshipType;
  questionKey: PersonalityCompatibilityQuestionKey;
  questionLabel: string;
  self: PersonalityCompatibilityInputPerson;
  partner: PersonalityCompatibilityInputPerson;
  createdAt: string;
}
