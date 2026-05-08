import type {
  SajuDataV1,
  SajuMajorLuckCycle,
  SajuPillar,
  StrengthLevel,
} from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import type { BirthInput, Element } from '@/lib/saju/types';

export const INTERPRET_API_CONTRACT_V1 = 'interpret-api-contract/v1' as const;

export type InterpretSajuStrength = 'strong' | 'balanced' | 'weak' | 'unknown';

export interface InterpretPillarSnapshot {
  stem: string;
  branch: string;
  ganzi: string;
}

export interface InterpretLuckSnapshot {
  stem: string | null;
  branch: string | null;
  ganzi: string | null;
  age: number | null;
  startAge?: number | null;
  endAge?: number | null;
}

export interface InterpretYearlyUnseSnapshot {
  stem: string | null;
  branch: string | null;
  ganzi: string | null;
  year: number | null;
}

export interface InterpretSajuDataSnapshot {
  schemaVersion: typeof INTERPRET_API_CONTRACT_V1;
  yearPillar: InterpretPillarSnapshot;
  monthPillar: InterpretPillarSnapshot;
  dayPillar: InterpretPillarSnapshot;
  hourPillar: InterpretPillarSnapshot | null;
  dayStem: string;
  ohaengRatio: Record<Element, number>;
  tenGods: Record<string, number>;
  yongsin: Element | null;
  sinji: InterpretSajuStrength;
  currentDaewoon: InterpretLuckSnapshot | null;
  yearlyUnse: InterpretYearlyUnseSnapshot | null;
}

export interface InterpretRequestContract {
  readingId: string;
  topic?: string;
  regenerate?: boolean;
  counselorId?: string;
  profileId?: string;
  sajuData?: InterpretSajuDataSnapshot;
  sajuDataHash?: string;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function roundNumber(value: number) {
  return Math.round(value * 10) / 10;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function splitGanzi(ganzi: string | null | undefined) {
  const normalized = typeof ganzi === 'string' && ganzi.trim() ? ganzi.trim() : null;
  if (!normalized) {
    return { stem: null, branch: null, ganzi: null };
  }

  return {
    stem: normalized.slice(0, 1) || null,
    branch: normalized.slice(1, 2) || null,
    ganzi: normalized,
  };
}

function toPillarSnapshot(pillar: SajuPillar): InterpretPillarSnapshot {
  return {
    stem: pillar.stem,
    branch: pillar.branch,
    ganzi: pillar.ganzi,
  };
}

function toStrength(level: StrengthLevel | null | undefined): InterpretSajuStrength {
  if (level === '신강') return 'strong';
  if (level === '신약') return 'weak';
  if (level === '중화') return 'balanced';
  return 'unknown';
}

function toLuckSnapshot(
  luck: SajuMajorLuckCycle | null | undefined,
  progressYears: number | null
): InterpretLuckSnapshot | null {
  if (!luck) return null;
  const ganzi = splitGanzi(luck.ganzi);

  return {
    ...ganzi,
    age: progressYears,
    startAge: luck.startAge,
    endAge: luck.endAge,
  };
}

function normalizeRatioRecord(record: Record<string, number>): Record<Element, number> {
  return {
    목: roundNumber(record.목 ?? 0),
    화: roundNumber(record.화 ?? 0),
    토: roundNumber(record.토 ?? 0),
    금: roundNumber(record.금 ?? 0),
    수: roundNumber(record.수 ?? 0),
  };
}

function normalizeNumericRecord(record: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([key, value]) => [key, roundNumber(value as number)])
  );
}

export function buildInterpretSajuDataSnapshot(
  input: BirthInput,
  data: SajuDataV1
): InterpretSajuDataSnapshot {
  const context = buildSajuPersonalizationContext(data);
  const yearly = data.currentLuck?.saewoon ? splitGanzi(data.currentLuck.saewoon.ganzi) : null;

  return {
    schemaVersion: INTERPRET_API_CONTRACT_V1,
    yearPillar: toPillarSnapshot(data.pillars.year),
    monthPillar: toPillarSnapshot(data.pillars.month),
    dayPillar: toPillarSnapshot(data.pillars.day),
    hourPillar: data.pillars.hour ? toPillarSnapshot(data.pillars.hour) : null,
    dayStem: data.dayMaster.stem,
    ohaengRatio: normalizeRatioRecord(context.fiveElementRatio),
    tenGods: normalizeNumericRecord(context.tenGodDistribution),
    yongsin: context.yongsinKiyshin.용신,
    sinji: toStrength(context.strengthJudgement.일간강약),
    currentDaewoon: toLuckSnapshot(data.currentLuck?.currentMajorLuck, context.currentLuck.진행년수),
    yearlyUnse: yearly
      ? {
          ...yearly,
          year: data.currentLuck?.saewoon?.year ?? new Date().getFullYear(),
        }
      : null,
  };
}

export function buildSajuDataCacheHash(input: BirthInput, data: SajuDataV1) {
  const snapshot = buildInterpretSajuDataSnapshot(input, data);

  return `saju_${stableHash(stableStringify(snapshot))}`;
}

export function buildReadingIdentityHash(input: BirthInput, data: SajuDataV1, userId?: string | null) {
  return `reading_${stableHash(
    stableStringify({
      userId: userId ?? 'anonymous',
      generatedAt: data.metadata.calculatedAt,
      input: {
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.unknownTime ? null : input.hour ?? null,
        minute: input.unknownTime ? null : input.minute ?? null,
        gender: input.gender ?? null,
        birthLocationCode: input.birthLocation?.code ?? null,
        birthLocationLabel: input.birthLocation?.label ?? null,
        solarTimeMode: input.solarTimeMode ?? null,
        jasiMethod: input.jasiMethod ?? null,
      },
      sajuDataHash: buildSajuDataCacheHash(input, data),
    })
  )}`;
}

function parsePillarSnapshot(value: unknown): InterpretPillarSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;

  const stem = typeof record.stem === 'string' ? record.stem.trim() : '';
  const branch = typeof record.branch === 'string' ? record.branch.trim() : '';
  const ganzi = typeof record.ganzi === 'string' ? record.ganzi.trim() : `${stem}${branch}`;

  if (!stem || !branch || !ganzi) return null;
  return { stem, branch, ganzi };
}

function parseLuckSnapshot(value: unknown): InterpretLuckSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;

  return {
    stem: typeof record.stem === 'string' ? record.stem : null,
    branch: typeof record.branch === 'string' ? record.branch : null,
    ganzi: typeof record.ganzi === 'string' ? record.ganzi : null,
    age: typeof record.age === 'number' ? record.age : null,
    startAge: typeof record.startAge === 'number' ? record.startAge : null,
    endAge: typeof record.endAge === 'number' ? record.endAge : null,
  };
}

function parseYearlySnapshot(value: unknown): InterpretYearlyUnseSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;

  return {
    stem: typeof record.stem === 'string' ? record.stem : null,
    branch: typeof record.branch === 'string' ? record.branch : null,
    ganzi: typeof record.ganzi === 'string' ? record.ganzi : null,
    year: typeof record.year === 'number' ? record.year : null,
  };
}

function parseRatioSnapshot(value: unknown): Record<Element, number> | null {
  const record = asRecord(value);
  if (!record) return null;

  return normalizeRatioRecord({
    목: Number(record.목 ?? 0),
    화: Number(record.화 ?? 0),
    토: Number(record.토 ?? 0),
    금: Number(record.금 ?? 0),
    수: Number(record.수 ?? 0),
  });
}

export function normalizeInterpretSajuDataSnapshot(
  value: unknown
): InterpretSajuDataSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;

  const yearPillar = parsePillarSnapshot(record.yearPillar);
  const monthPillar = parsePillarSnapshot(record.monthPillar);
  const dayPillar = parsePillarSnapshot(record.dayPillar);
  const ohaengRatio = parseRatioSnapshot(record.ohaengRatio);
  const dayStem = typeof record.dayStem === 'string' ? record.dayStem.trim() : '';

  if (!yearPillar || !monthPillar || !dayPillar || !ohaengRatio || !dayStem) {
    return null;
  }

  const sinji =
    record.sinji === 'strong' ||
    record.sinji === 'weak' ||
    record.sinji === 'balanced' ||
    record.sinji === 'unknown'
      ? record.sinji
      : 'unknown';

  return {
    schemaVersion: INTERPRET_API_CONTRACT_V1,
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar: record.hourPillar === null ? null : parsePillarSnapshot(record.hourPillar),
    dayStem,
    ohaengRatio,
    tenGods: normalizeNumericRecord(asRecord(record.tenGods) ?? {}),
    yongsin:
      record.yongsin === '목' ||
      record.yongsin === '화' ||
      record.yongsin === '토' ||
      record.yongsin === '금' ||
      record.yongsin === '수'
        ? record.yongsin
        : null,
    sinji,
    currentDaewoon: parseLuckSnapshot(record.currentDaewoon),
    yearlyUnse: parseYearlySnapshot(record.yearlyUnse),
  };
}

export function isSameInterpretSajuDataSnapshot(
  left: InterpretSajuDataSnapshot,
  right: InterpretSajuDataSnapshot
) {
  return stableStringify(left) === stableStringify(right);
}
