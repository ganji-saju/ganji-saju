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

export type PersonalityProfileSource = 'self_reported' | 'moonlight_check';

export type PersonalityRelationshipType =
  | 'lover'
  | 'spouse'
  | 'friend'
  | 'family'
  | 'work'
  | 'other';

export type PersonalityQuestionType =
  | 'general'
  | 'love'
  | 'conflict'
  | 'recovery'
  | 'money'
  | 'work'
  | 'family';

export type JsonObject = Record<string, unknown>;

export interface PersonalityProfile {
  id: string;
  userId: string;
  profileId: string | null;
  typeCode: PersonalityTypeCode;
  source: PersonalityProfileSource;
  confidence: number;
  answersJson: JsonObject;
  createdAt: string;
}

export interface CreatePersonalityProfileInput {
  userId: string;
  profileId?: string | null;
  typeCode: PersonalityTypeCode;
  source: PersonalityProfileSource;
  confidence?: number;
  answersJson?: JsonObject;
}

export interface PersonalityCompatibilityScoreJson {
  overall: number;
  emotionalTemperature: number;
  communicationTempo: number;
  conflictRecovery: number;
  lifeRhythm: number;
  realityAlignment: number;
}

export interface CompatibilitySajuFacts {
  selfDayMaster?: string;
  partnerDayMaster?: string;
  sharedElements?: string[];
  tensionSignals?: string[];
  supportSignals?: string[];
  raw?: JsonObject;
}

export interface CompatibilityPersonalityFacts {
  selfType: PersonalityTypeCode | null;
  partnerType: PersonalityTypeCode | null;
  selfSource?: PersonalityProfileSource;
  partnerSource?: PersonalityProfileSource;
  axisNotes?: Record<string, string>;
  raw?: JsonObject;
}

export interface CompatibilityPersonalityPaidSections {
  communication: string;
  conflictPattern: string;
  recoverySentence: string;
  practicalActions: string[];
}

export interface CompatibilityPersonalityReportContent {
  headline: string;
  summary: string;
  strengths: string[];
  cautions: string[];
  action: string;
  paidSections?: CompatibilityPersonalityPaidSections;
}

export interface CompatibilityPersonalityReport {
  id: string;
  userId: string;
  profileAId: string | null;
  profileBId: string | null;
  relationshipType: PersonalityRelationshipType | string;
  questionType: PersonalityQuestionType | string;
  scoreJson: PersonalityCompatibilityScoreJson;
  sajuFactsJson: CompatibilitySajuFacts;
  personalityFactsJson: CompatibilityPersonalityFacts;
  reportJson: CompatibilityPersonalityReportContent | JsonObject;
  productCode: string;
  paidAmount: number | null;
  createdAt: string;
}

export interface CreateCompatibilityPersonalityReportInput {
  userId: string;
  profileAId?: string | null;
  profileBId?: string | null;
  relationshipType: PersonalityRelationshipType | string;
  questionType?: PersonalityQuestionType | string;
  scoreJson: PersonalityCompatibilityScoreJson;
  sajuFactsJson: CompatibilitySajuFacts;
  personalityFactsJson: CompatibilityPersonalityFacts;
  reportJson: CompatibilityPersonalityReportContent | JsonObject;
  productCode?: string;
  paidAmount?: number | null;
}

export interface ReportFeedback {
  id: string;
  reportId: string;
  userId: string;
  rating: number;
  tagsJson: string[];
  comment: string | null;
  createdAt: string;
}

export interface CreateReportFeedbackInput {
  reportId: string;
  userId: string;
  rating: number;
  tagsJson?: string[];
  comment?: string | null;
}
