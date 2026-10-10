import 'server-only';
import { randomUUID } from 'node:crypto';
import { buildPdfModel, type PdfReportModel } from '@/lib/saju/pdf-report-model';
import { buildTransientReading } from '@/lib/saju/readings';
import type { BirthInput } from '@/lib/saju/types';
import { isUnifiedBirthEntryDraft, resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { generateLifetimeInterpretation } from '@/server/ai/saju-lifetime-service';
import { createInMemoryLifetimeCacheStore } from '@/server/ai/lifetime/lifetime-cache-store';
import { createInMemoryLlmTelemetryStore } from '@/server/ai/llm-telemetry';
import { createInMemoryYearlyCacheStore, generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';
import type { SajuYearlyAiInterpretation } from '@/server/ai/saju-yearly-interpretation';
import { buildLifetimeReport, type SajuYearlyReport } from '@/domain/saju/report';
import { NEW_YEAR_TARGET_YEAR } from '@/lib/payments/catalog';
import { dedupeSentencesDeep } from '@/lib/saju/dedupe-sentences';

export type ExternalReportRequest = UnifiedBirthEntryDraft & { name: string };
/** lifetime = 깊은 사주풀이(종합), new-year = 2027 신년운세. 값이 없으면 종합(기존 요청 호환). */
export type ExternalReportKind = 'lifetime' | 'new-year';
export type ParsedExternalReport =
  | { ok: true; kind: ExternalReportKind; input: BirthInput; birth: ExternalReportRequest }
  | { ok: false; error: string };

/** 원문을 URL·회원 프로필에 저장하지 않는다. 음력 변환도 검증 실패로 안전하게 돌려준다. */
export function parseExternalReportRequest(payload: unknown): ParsedExternalReport {
  const invalid = (error: string): ParsedExternalReport => ({ ok: false, error });
  if (!isUnifiedBirthEntryDraft(payload)) return invalid('생년월일과 출생 정보 입력을 확인해 주세요.');
  const kindValue = (payload as unknown as Record<string, unknown>).kind;
  if (kindValue !== undefined && kindValue !== 'lifetime' && kindValue !== 'new-year') return invalid('보고서 종류를 선택해 주세요.');
  const kind: ExternalReportKind = kindValue ?? 'lifetime';
  const nameValue = (payload as unknown as Record<string, unknown>).name;
  const name = typeof nameValue === 'string' ? nameValue.trim() : '';
  if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) {
    return invalid('이름은 1자 이상 40자 이하로 입력해 주세요.');
  }
  if (payload.gender !== 'male' && payload.gender !== 'female') return invalid('성별을 선택해 주세요.');
  if (!/^\d{4}$/.test(payload.year) || !/^\d{1,2}$/.test(payload.month) || !/^\d{1,2}$/.test(payload.day) ||
      Number(payload.year) < 1900 || Number(payload.year) > 2100 || Number(payload.month) < 1 ||
      Number(payload.month) > 12 || Number(payload.day) < 1 || Number(payload.day) > (payload.calendarType === 'lunar' ? 30 : 31)) {
    return invalid('생년월일을 다시 확인해 주세요.');
  }
  if (!payload.unknownBirthTime && (!/^\d{1,2}$/.test(payload.hour) || Number(payload.hour) > 23 ||
      (payload.minute !== '' && (!/^\d{1,2}$/.test(payload.minute) || Number(payload.minute) > 59)))) {
    return invalid('출생 시간을 입력하거나 시간 모름을 선택해 주세요.');
  }
  if (payload.birthLocationCode.length > 40 || payload.birthLocationLabel.length > 120 ||
      payload.birthLatitude.length > 30 || payload.birthLongitude.length > 30) {
    return invalid('출생 지역 입력을 확인해 주세요.');
  }
  if (!payload.unknownBirthTime && payload.timeRule === 'trueSolarTime' &&
      (!payload.birthLocationCode.trim() || !payload.birthLatitude.trim() || !payload.birthLongitude.trim())) {
    return invalid('진태양시를 적용하려면 출생지와 좌표를 입력해 주세요.');
  }
  try {
    const result = resolveUnifiedBirthInput({
      ...payload,
      hour: payload.unknownBirthTime ? '' : payload.hour,
      minute: payload.unknownBirthTime ? '' : payload.minute,
    }, { requireGender: true });
    if (!result.ok) return result;
    // 양력 변환 전 입력을 명시한 필드만 보관한다. 임의의 요청 키는 저장하지 않는다.
    const birth: ExternalReportRequest = {
      name, calendarType: payload.calendarType, timeRule: payload.timeRule,
      year: payload.year, month: payload.month, day: payload.day,
      hour: payload.unknownBirthTime ? '' : payload.hour,
      minute: payload.unknownBirthTime ? '' : payload.minute,
      unknownBirthTime: payload.unknownBirthTime, gender: payload.gender,
      birthLocationCode: payload.birthLocationCode.trim(),
      birthLocationLabel: payload.birthLocationLabel.trim(),
      birthLatitude: payload.birthLatitude.trim(), birthLongitude: payload.birthLongitude.trim(),
    };
    return { ok: true, kind, input: { ...result.input, name }, birth };
  } catch {
    return invalid('해당 달력에 없는 날짜입니다. 생년월일을 다시 확인해 주세요.');
  }
}

export interface ExternalReportResult {
  /** 옛 기록(신년운세 추가 전)에는 없다 → 종합으로 본다. */
  kind?: 'lifetime';
  data: PdfReportModel;
  issuedAt: string;
  generationSource: 'openai' | 'fallback';
  generationWarning?: string;
}

/** 고객용 신년운세 PDF(/saju/[slug]/new-year/[year]/print)와 같은 본문·문서를 그리는 데 필요한 값. */
export interface ExternalNewYearReportResult extends Omit<ExternalReportResult, 'kind'> {
  kind: 'new-year';
  year: number;
  report: SajuYearlyReport;
  interpretation: SajuYearlyAiInterpretation;
}

export type ExternalReportSnapshot = ExternalReportResult | ExternalNewYearReportResult;

const FALLBACK_WARNING = 'AI 확장 풀이를 완료하지 못해 기본 계산 풀이로 생성했습니다. 고객에게 전달하기 전에 내용을 확인하거나 다시 생성해 주세요.';

function kstToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return { year: Number(part('year')), stamp: `${part('year')}${part('month')}${part('day')}`, issuedAt: `${part('year')}.${part('month')}.${part('day')}` };
}

/** 고객 계정·reading·이용권 없이 기존 고객 PDF와 같은 생성기/모델을 사용한다. */
export async function generateExternalReport(input: BirthInput, options: { signal?: AbortSignal } = {}): Promise<ExternalReportResult> {
  options.signal?.throwIfAborted();
  const { year: targetYear, stamp, issuedAt } = kstToday();
  const token = randomUUID();
  // UUID로만 보이는 ID면 기존 서비스가 readings 챕터 저장을 시도하므로 접두사를 붙인다.
  const reading = buildTransientReading(input, `external-report-${token}`);
  const interpretationResult = await generateLifetimeInterpretation({
    readingIdentifier: reading.id,
    readingRecord: reading,
    targetYear,
    cacheStore: createInMemoryLifetimeCacheStore(),
    telemetryStore: createInMemoryLlmTelemetryStore(),
    deadlineAt: Date.now() + 240_000,
    signal: options.signal,
  });
  options.signal?.throwIfAborted();
  if (!interpretationResult) throw new Error('external_report_generation_failed');
  const reportNo = `GS-EXT-${stamp}-${token.slice(0, 8).toUpperCase()}`;
  return {
    data: buildPdfModel(reading, interpretationResult.report, reportNo, targetYear, interpretationResult.interpretation),
    issuedAt,
    generationSource: interpretationResult.source,
    ...(interpretationResult.source === 'fallback' ? { generationWarning: FALLBACK_WARNING } : {}),
  };
}

/** 2027 신년운세만 단독으로. 고객용 신년운세 PDF와 같은 생성기·문장 정리·명식 모델을 쓰고, 결과는 DB 캐시에 남기지 않는다. */
export async function generateExternalNewYearReport(input: BirthInput, options: { signal?: AbortSignal } = {}): Promise<ExternalNewYearReportResult> {
  options.signal?.throwIfAborted();
  const { stamp, issuedAt } = kstToday();
  const token = randomUUID();
  const reading = buildTransientReading(input, `external-report-${token}`);
  const response = await generateYearlyInterpretation({
    readingIdentifier: reading.id,
    readingRecord: reading,
    targetYear: NEW_YEAR_TARGET_YEAR,
    includeNewYear: true,
    cacheStore: createInMemoryYearlyCacheStore(),
  });
  options.signal?.throwIfAborted();
  if (!response) throw new Error('external_report_generation_failed');
  // 기록 목록은 snapshot 없이 보고서 번호 접두사(GS-EXT-NY)로 종류를 구분한다.
  const reportNo = `GS-EXT-NY${NEW_YEAR_TARGET_YEAR % 100}-${stamp}-${token.slice(0, 8).toUpperCase()}`;
  return {
    kind: 'new-year',
    year: NEW_YEAR_TARGET_YEAR,
    data: buildPdfModel(reading, buildLifetimeReport(reading.input, reading.sajuData, NEW_YEAR_TARGET_YEAR), reportNo, NEW_YEAR_TARGET_YEAR),
    report: response.report,
    interpretation: dedupeSentencesDeep(response.interpretation),
    issuedAt,
    generationSource: response.source,
    ...(response.source === 'fallback' ? { generationWarning: FALLBACK_WARNING } : {}),
  };
}

export function isNewYearReportNo(reportNo: string): boolean {
  return reportNo.startsWith('GS-EXT-NY');
}
