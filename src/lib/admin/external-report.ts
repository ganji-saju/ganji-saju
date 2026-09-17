import 'server-only';
import { randomUUID } from 'node:crypto';
import { buildPdfModel, type PdfReportModel } from '@/lib/saju/pdf-report-model';
import { buildTransientReading } from '@/lib/saju/readings';
import type { BirthInput } from '@/lib/saju/types';
import { isUnifiedBirthEntryDraft, resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { generateLifetimeInterpretation } from '@/server/ai/saju-lifetime-service';
import { createInMemoryLifetimeCacheStore } from '@/server/ai/lifetime/lifetime-cache-store';
import { createInMemoryLlmTelemetryStore } from '@/server/ai/llm-telemetry';

export type ExternalReportRequest = UnifiedBirthEntryDraft & { name: string };
export type ParsedExternalReport = { ok: true; input: BirthInput } | { ok: false; error: string };

/** 원문을 URL·회원 프로필에 저장하지 않는다. 음력 변환도 검증 실패로 안전하게 돌려준다. */
export function parseExternalReportRequest(payload: unknown): ParsedExternalReport {
  const invalid = (error: string): ParsedExternalReport => ({ ok: false, error });
  if (!isUnifiedBirthEntryDraft(payload)) return invalid('생년월일과 출생 정보 입력을 확인해 주세요.');
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
    return result.ok ? { ok: true, input: { ...result.input, name } } : result;
  } catch {
    return invalid('해당 달력에 없는 날짜입니다. 생년월일을 다시 확인해 주세요.');
  }
}

export interface ExternalReportResult {
  data: PdfReportModel;
  issuedAt: string;
  generationSource: 'openai' | 'fallback';
  generationWarning?: string;
}

/** 고객 계정·reading·이용권 없이 기존 고객 PDF와 같은 생성기/모델을 사용한다. */
export async function generateExternalReport(input: BirthInput, options: { signal?: AbortSignal } = {}): Promise<ExternalReportResult> {
  options.signal?.throwIfAborted();
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  const targetYear = Number(part('year'));
  const issuedAt = `${part('year')}.${part('month')}.${part('day')}`;
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
  const reportNo = `GS-EXT-${part('year')}${part('month')}${part('day')}-${token.slice(0, 8).toUpperCase()}`;
  return {
    data: buildPdfModel(reading, interpretationResult.report, reportNo, targetYear, interpretationResult.interpretation),
    issuedAt,
    generationSource: interpretationResult.source,
    ...(interpretationResult.source === 'fallback' ? {
      generationWarning: 'AI 확장 풀이를 완료하지 못해 기본 계산 풀이로 생성했습니다. 고객에게 전달하기 전에 내용을 확인하거나 다시 생성해 주세요.',
    } : {}),
  };
}
