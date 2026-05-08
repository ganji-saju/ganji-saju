import type {
  SajuComputationMetadata,
  SajuCurrentLuck,
  SajuDataVersion,
  SajuFiveElements,
  SajuMajorLuckCycle,
  SajuPattern,
  SajuPillars,
  SajuStrength,
  SajuTenGodSummary,
  SajuYongsin,
} from '@/domain/saju/engine/saju-data-v1';
import type { BirthInput } from '@/lib/saju/types';
import type {
  ReportEvidenceCard,
  ReportEvidenceConfidence,
  ReportEvidenceKey,
  ReportEvidenceSource,
} from './types';
import type { SajuPersonalizationContext } from './personalization-context';

export const SAJU_FACT_JSON_V1 = 'saju-fact/v1' as const;
export const SAJU_EVIDENCE_JSON_V1 = 'saju-evidence/v1' as const;

export interface SajuFactJson {
  schemaVersion: typeof SAJU_FACT_JSON_V1;
  sajuDataVersion: SajuDataVersion;
  birthInput: {
    year: number;
    month: number;
    day: number;
    hour: number | null;
    minute: number | null;
    hourKnown: boolean;
    gender: BirthInput['gender'] | null;
    birthLocationLabel: string | null;
    birthLocationCode: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    solarTimeMode: BirthInput['solarTimeMode'] | null;
    jasiMethod: BirthInput['jasiMethod'] | null;
    birthTimeCorrectionMinutes: number | null;
  };
  calendarConversion: {
    calendar: 'solar';
    timezone: string;
    hourKnown: boolean;
    location: string | null;
    solarTimeMode: string | null;
    jasiMethod: string | null;
    birthTimeCorrectionMinutes: number | null;
  };
  pillars: SajuPillars;
  dayMaster: {
    stem: string;
    element: string;
    yinYang: string;
    metaphor: string | null;
    description: string | null;
  };
  fiveElements: SajuFiveElements;
  tenGods: SajuTenGodSummary | null;
  strength: SajuStrength | null;
  pattern: SajuPattern | null;
  yongsin: SajuYongsin | null;
  luckCycles: {
    majorLuck: SajuMajorLuckCycle[] | null;
    currentLuck: SajuCurrentLuck | null;
  };
  relations: {
    relations: Array<Record<string, unknown>>;
    gongmang: Record<string, unknown> | null;
    specialSals: Record<string, unknown> | null;
  };
  metadata: SajuComputationMetadata;
}

export interface SajuEvidenceSummaryCard {
  key: ReportEvidenceKey;
  label: string;
  title: string;
  plainSummary: string;
  technicalSummary: string | null;
  confidence: ReportEvidenceConfidence;
  source: ReportEvidenceSource[];
  details: string[];
}

export interface SajuEvidenceStrength {
  level: string | null;
  score: number | null;
  rationale: string[];
}

export interface SajuEvidencePattern {
  name: string | null;
  category: string | null;
  tenGod: string | null;
  rationale: string[];
}

export interface SajuEvidenceYongsinCandidate {
  method: string;
  role: string;
  primary: string;
  support: string[];
  kiyshin: string[];
  score: number;
  rationale: string[];
  plainSummary: string;
  technicalSummary: string;
}

export interface SajuEvidenceJson {
  schemaVersion: typeof SAJU_EVIDENCE_JSON_V1;
  primaryConcept: string;
  strength: SajuEvidenceStrength;
  pattern: SajuEvidencePattern;
  yongsin: {
    method: string | null;
    confidence: string | null;
    primary: string | null;
    support: string[];
    kiyshin: string[];
    rationale: string[];
    practicalActions: string[];
    candidates: SajuEvidenceYongsinCandidate[];
  };
  luckFlow: {
    currentMajorLuck: string | null;
    currentMajorLuckNotes: string[];
    saewoon: string | null;
    saewoonNotes: string[];
    wolwoon: string | null;
    wolwoonNotes: string[];
  };
  relations: {
    relations: string[];
    gongmang: string[];
    specialSals: string[];
  };
  classics: {
    cards: SajuEvidenceSummaryCard[];
  };
}

export interface SajuInterpretationGrounding {
  factJson: SajuFactJson;
  evidenceJson: SajuEvidenceJson;
  personalizationContext: SajuPersonalizationContext;
}

export type SajuGroundingEvidenceCard = Pick<
  ReportEvidenceCard,
  'key' | 'label' | 'title' | 'plainSummary' | 'technicalSummary' | 'confidence' | 'source' | 'details'
>;
