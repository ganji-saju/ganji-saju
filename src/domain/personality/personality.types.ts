export const PERSONALITY_TYPE_CODES = [
  'ISTJ',
  'ISFJ',
  'INFJ',
  'INTJ',
  'ISTP',
  'ISFP',
  'INFP',
  'INTP',
  'ESTP',
  'ESFP',
  'ENFP',
  'ENTP',
  'ESTJ',
  'ESFJ',
  'ENFJ',
  'ENTJ',
] as const;

export type PersonalityTypeCode = (typeof PERSONALITY_TYPE_CODES)[number];

export type PersonalityAxis = 'IE' | 'SN' | 'TF' | 'JP';

export type PersonalityAxisPole = 'I' | 'E' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

export type PersonalityProfileSource = 'self_reported' | 'moonlight_check';

export type PersonalityAxisScores = Record<PersonalityAxis, number>;

export interface PersonalityCheckOption {
  value: string;
  label: string;
  pole: PersonalityAxisPole;
  score: number;
}

export interface PersonalityCheckQuestion {
  id: string;
  axis: PersonalityAxis;
  title: string;
  options: readonly PersonalityCheckOption[];
}

export interface PersonalityCheckAnswer {
  questionId: string;
  value: string;
}

export interface PersonalityProfile {
  typeCode: PersonalityTypeCode;
  source: PersonalityProfileSource;
  confidence: number;
  answers?: readonly PersonalityCheckAnswer[];
}

export interface PersonalityCheckResult {
  typeCode: PersonalityTypeCode;
  confidence: number;
  axisScores: PersonalityAxisScores;
  answeredCount: number;
  missingQuestionIds: string[];
}

export interface PersonalityTypeProfile {
  code: PersonalityTypeCode;
  title: string;
  communicationStyle: string;
  relationshipHint: string;
  caution: string;
}

export interface PersonalityCommunicationRule {
  axis: PersonalityAxis;
  pole: PersonalityAxisPole;
  title: string;
  prefers: string;
  carePoint: string;
}
