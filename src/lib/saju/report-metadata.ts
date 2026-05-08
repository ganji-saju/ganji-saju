import type {
  SajuComputationMetadata,
  SajuCompleteness,
  SajuDataV1,
  SajuPendingSection,
  SajuComputationSource,
} from '@/domain/saju/engine/saju-data-v1';
import {
  buildReadingIdentityHash,
  buildSajuDataCacheHash,
} from '@/domain/saju/report/interpret-api-contract';
import type { SajuInterpretationGrounding } from '@/domain/saju/report';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import type { BirthInput } from '@/lib/saju/types';
import type { DecisionTraceItem, ReportMetadata } from './report-contract';

export const SAJU_READING_METADATA_V1 = 'saju-reading-metadata/v1' as const;

type ReadingMetadataSchemaVersion = typeof SAJU_READING_METADATA_V1;
type ReportGenerationSource = 'openai' | 'fallback' | null;

export interface SajuBirthInputSnapshot {
  name?: string | null;
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  unknownTime: boolean;
  gender: BirthInput['gender'] | null;
  birthLocation: {
    code: string | null;
    label: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
  } | null;
  solarTimeMode: BirthInput['solarTimeMode'] | null;
  jasiMethod: BirthInput['jasiMethod'] | null;
}

export interface SajuPersistedReadingMetadata extends ReportMetadata {
  schemaVersion: ReadingMetadataSchemaVersion;
  engineVersion: string;
  ruleSetVersion: string;
  factSchemaVersion: string;
  evidenceSchemaVersion: string;
  generatedAt: string;
  computation: {
    source: SajuComputationSource;
    calculatedAt: string;
    completeness: SajuCompleteness;
    pendingSections: SajuPendingSection[];
  };
  birthInputSnapshot: SajuBirthInputSnapshot;
  timeReference: {
    timezone: string;
    location: string | null;
    solarTimeMode: string | null;
    jasiMethod: string | null;
    birthTimeCorrectionMinutes: number | null;
    hourKnown: boolean;
  };
  verification: {
    kasiCompared: boolean;
    kasiIssueCount: number;
  };
  sajuDataHash?: string;
  readingIdentityHash?: string;
}

export interface SajuReportRuntimeMetadata extends SajuPersistedReadingMetadata {
  promptVersion?: string;
  llmModel?: string;
  generationSource: ReportGenerationSource;
  decisionTrace?: DecisionTraceItem[];
}

function buildBirthInputSnapshot(input: BirthInput): SajuBirthInputSnapshot {
  return {
    name: input.name ?? null,
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.unknownTime ? null : input.hour ?? null,
    minute: input.unknownTime ? null : input.minute ?? null,
    unknownTime: input.unknownTime === true || input.hour === undefined,
    gender: input.gender ?? null,
    birthLocation: input.birthLocation
      ? {
          code: input.birthLocation.code ?? null,
          label: input.birthLocation.label ?? null,
          latitude: input.birthLocation.latitude ?? null,
          longitude: input.birthLocation.longitude ?? null,
          timezone: input.birthLocation.timezone ?? null,
        }
      : null,
    solarTimeMode: input.solarTimeMode ?? null,
    jasiMethod: input.jasiMethod ?? null,
  };
}

function normalizeComputation(metadata: SajuComputationMetadata) {
  return {
    source: metadata.source,
    calculatedAt: metadata.calculatedAt,
    completeness: metadata.completeness,
    pendingSections: [...metadata.pendingSections],
  };
}

export function buildPersistedSajuReadingMetadata(
  input: BirthInput,
  sajuData: SajuDataV1,
  grounding: SajuInterpretationGrounding,
  kasiComparison: KasiSingleInputComparison | null,
  options: {
    userId?: string | null;
  } = {}
): SajuPersistedReadingMetadata {
  return {
    schemaVersion: SAJU_READING_METADATA_V1,
    engineVersion: sajuData.metadata.engineVersion,
    ruleSetVersion: sajuData.metadata.ruleSetVersion,
    factSchemaVersion: grounding.factJson.schemaVersion,
    evidenceSchemaVersion: grounding.evidenceJson.schemaVersion,
    generatedAt: sajuData.metadata.calculatedAt,
    computation: normalizeComputation(sajuData.metadata),
    birthInputSnapshot: buildBirthInputSnapshot(input),
    timeReference: {
      timezone: sajuData.input.timezone,
      location: sajuData.input.location,
      solarTimeMode: sajuData.input.solarTimeMode ?? null,
      jasiMethod: sajuData.input.jasiMethod ?? null,
      birthTimeCorrectionMinutes: sajuData.input.birthTimeCorrection?.offsetMinutes ?? null,
      hourKnown: sajuData.input.hourKnown,
    },
    verification: {
      kasiCompared: kasiComparison !== null,
      kasiIssueCount: kasiComparison?.issues.length ?? 0,
    },
    sajuDataHash: buildSajuDataCacheHash(input, sajuData),
    readingIdentityHash: buildReadingIdentityHash(input, sajuData, options.userId),
  };
}

export function buildSajuReportRuntimeMetadata(
  persisted: SajuPersistedReadingMetadata,
  options: {
    promptVersion?: string | null;
    llmModel?: string | null;
    generationSource?: ReportGenerationSource;
    decisionTrace?: DecisionTraceItem[];
  } = {}
): SajuReportRuntimeMetadata {
  return {
    ...persisted,
    promptVersion: options.promptVersion ?? undefined,
    llmModel: options.llmModel ?? undefined,
    generationSource: options.generationSource ?? null,
    decisionTrace: options.decisionTrace,
  };
}
