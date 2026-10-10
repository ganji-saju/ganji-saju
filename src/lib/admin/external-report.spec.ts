import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Lunar } from 'lunar-typescript';
import { buildLifetimeReport } from '@/domain/saju/report';
import { buildFallbackLifetimeInterpretation } from '@/server/ai/saju-lifetime-interpretation';
import type { LifetimeInterpretationResponsePayload } from '@/server/ai/saju-lifetime-service';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => { throw new Error('customer persistence must not run'); }),
  createServiceClient: vi.fn(() => { throw new Error('database must not run'); }),
  hasSupabaseServiceEnv: false,
}));
vi.mock('@/server/ai/saju-lifetime-service', () => ({ generateLifetimeInterpretation: vi.fn() }));
vi.mock('@/server/ai/saju-yearly-service', () => ({
  generateYearlyInterpretation: vi.fn(),
  createInMemoryYearlyCacheStore: vi.fn(() => ({ read: vi.fn(async () => null), write: vi.fn(async () => undefined) })),
}));

import { createServiceClient } from '@/lib/supabase/server';
import { generateLifetimeInterpretation } from '@/server/ai/saju-lifetime-service';
import { buildYearlyReport } from '@/domain/saju/report/build-yearly-report';
import { buildFallbackYearlyInterpretation } from '@/server/ai/saju-yearly-interpretation';
import { generateYearlyInterpretation, type YearlyInterpretationResponsePayload } from '@/server/ai/saju-yearly-service';
import {
  generateExternalNewYearReport, generateExternalReport, isNewYearReportNo, parseExternalReportRequest, type ExternalReportRequest,
} from './external-report';

const draft: ExternalReportRequest = {
  name: ' 스마트 구매자 ', calendarType: 'solar', timeRule: 'standard',
  year: '1982', month: '1', day: '29', hour: '8', minute: '45', unknownBirthTime: false,
  gender: 'male', birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
};

describe('external report input', () => {
  it('preserves the buyer name and shared birth/time fields', () => {
    const parsed = parseExternalReportRequest(draft);
    expect(parsed).toMatchObject({ ok: true, input: { name: '스마트 구매자', year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' } });
  });

  it.each([
    { name: '' }, { name: 'x'.repeat(41) }, { name: 'bad\u0000name' }, { gender: '' },
    { month: '2', day: '31' }, { year: '1982junk', calendarType: 'lunar' },
    { hour: '' }, { hour: '24' }, { minute: '60' }, { year: '1899' },
    { calendarType: 'lunar', month: '13' }, { calendarType: 'lunar', day: '31' },
    { birthLocationCode: 'custom', birthLatitude: '91', birthLongitude: '127' },
  ])('rejects invalid input %j', (change) => {
    expect(parseExternalReportRequest({ ...draft, ...change }).ok).toBe(false);
  });

  it('handles unknown time and solar conversion with the shared resolver', () => {
    const solar = Lunar.fromYmd(1982, 1, 5).getSolar();
    const result = parseExternalReportRequest({ ...draft, calendarType: 'lunar', day: '5', unknownBirthTime: true, hour: '', minute: '' });
    expect(result).toMatchObject({ ok: true, input: { name: '스마트 구매자', year: solar.getYear(), month: solar.getMonth(), day: solar.getDay(), unknownTime: true } });
    if (result.ok) expect(result.input.hour).toBeUndefined();
  });

  it('keeps the validated original lunar birthday and only whitelisted fields for history', () => {
    const original = { ...draft, calendarType: 'lunar', day: '5', unknownBirthTime: true };
    const result = parseExternalReportRequest({ ...original, phone: '010-private', snapshot: { injected: true }, created_by: 'other-admin' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.birth).toEqual({
      ...original, name: '스마트 구매자', hour: '', minute: '',
    });
    expect(result.birth).toMatchObject({ calendarType: 'lunar', year: '1982', month: '1', day: '5' });
    const solar = Lunar.fromYmd(1982, 1, 5).getSolar();
    expect(result.input).toMatchObject({ year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() });
  });

  it('requires location and coordinates for known-time true solar correction', () => {
    const location = { birthLocationCode: 'custom', birthLocationLabel: '서울', birthLatitude: '37.5665', birthLongitude: '126.978' };
    for (const missing of [{ birthLocationCode: '' }, { birthLatitude: ' ' }, { birthLongitude: '' }]) {
      expect(parseExternalReportRequest({ ...draft, ...location, ...missing, timeRule: 'trueSolarTime' }))
        .toEqual({ ok: false, error: '진태양시를 적용하려면 출생지와 좌표를 입력해 주세요.' });
    }
    expect(parseExternalReportRequest({ ...draft, ...location, timeRule: 'trueSolarTime' }))
      .toMatchObject({ ok: true, input: { solarTimeMode: 'longitude' } });
    expect(parseExternalReportRequest({ ...draft, timeRule: 'trueSolarTime', unknownBirthTime: true }).ok).toBe(true);
  });

  it('defaults to the lifetime report, accepts new-year and rejects unknown kinds', () => {
    expect(parseExternalReportRequest(draft)).toMatchObject({ ok: true, kind: 'lifetime' });
    expect(parseExternalReportRequest({ ...draft, kind: 'new-year' })).toMatchObject({ ok: true, kind: 'new-year' });
    expect(parseExternalReportRequest({ ...draft, kind: 'lifetime' })).toMatchObject({ ok: true, kind: 'lifetime' });
    for (const kind of ['', 'yearly', 2027, null]) {
      expect(parseExternalReportRequest({ ...draft, kind })).toEqual({ ok: false, error: '보고서 종류를 선택해 주세요.' });
    }
    const parsed = parseExternalReportRequest({ ...draft, kind: 'new-year' });
    if (parsed.ok) expect(parsed.birth).not.toHaveProperty('kind');
  });

  it('returns validation errors for malformed values without throwing', () => {
    for (const value of [null, [], {}, { ...draft, calendarType: 'lunar', year: '2026', month: '2', day: '30' }]) {
      expect(() => parseExternalReportRequest(value)).not.toThrow();
      expect(parseExternalReportRequest(value).ok).toBe(false);
    }
    expect(parseExternalReportRequest({ ...draft, calendarType: 'lunar', year: '2026', month: '2', day: '29' }).ok).toBe(true);
  });
});

describe('external report generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateLifetimeInterpretation).mockImplementation(async (request) => {
      const reading = request.readingRecord!;
      const report = buildLifetimeReport(reading.input, reading.sajuData, request.targetYear);
      return {
        report, interpretation: buildFallbackLifetimeInterpretation(report, 'female'), source: 'fallback',
      } as LifetimeInterpretationResponsePayload;
    });
  });

  it('uses transient buyer data, isolated stores and the shared PDF model without DB writes', async () => {
    const parsed = parseExternalReportRequest(draft);
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await generateExternalReport(parsed.input);
    const [request] = vi.mocked(generateLifetimeInterpretation).mock.calls[0];
    expect(request.readingRecord?.userId).toBeNull();
    expect(request.readingRecord?.id).toMatch(/^external-report-/);
    expect(request.readingRecord?.input.name).toBe('스마트 구매자');
    expect(request.readingRecord?.metadata.birthInputSnapshot.name).toBe('스마트 구매자');
    expect(request.cacheStore).toBeDefined();
    expect(await request.cacheStore!.get('never-written', 'test')).toBeNull();
    expect(request.telemetryStore).toBeDefined();
    expect(request.deadlineAt).toBeGreaterThan(Date.now());
    expect(result.data.subjectName).toBe('스마트 구매자');
    expect(result.data.reportNo).toMatch(/^GS-EXT-\d{8}-[A-F0-9]{8}$/);
    expect(result.issuedAt).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(result.generationSource).toBe('fallback');
    expect(result.generationWarning).toContain('기본 계산 풀이');
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});

describe('external new-year report generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateYearlyInterpretation).mockImplementation(async (request) => {
      const reading = request.readingRecord!;
      const report = buildYearlyReport(reading.input, reading.sajuData, request.targetYear);
      const interpretation = buildFallbackYearlyInterpretation(report, 'female');
      // 같은 문장이 두 번 들어오면 고객용 PDF처럼 한 번만 남아야 한다.
      interpretation.opening = '올해는 차분하게 기반을 다지는 해입니다. 올해는 차분하게 기반을 다지는 해입니다.';
      return { report, interpretation, source: 'openai' } as unknown as YearlyInterpretationResponsePayload;
    });
  });

  it('uses the customer new-year generator with transient buyer data, an isolated cache and no DB writes', async () => {
    const parsed = parseExternalReportRequest({ ...draft, kind: 'new-year' });
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await generateExternalNewYearReport(parsed.input);
    const [request] = vi.mocked(generateYearlyInterpretation).mock.calls[0];
    expect(request).toMatchObject({ targetYear: 2027, includeNewYear: true });
    expect(request.readingRecord?.userId).toBeNull();
    expect(request.readingRecord?.id).toMatch(/^external-report-/);
    expect(request.readingIdentifier).toBe(request.readingRecord?.id);
    expect(request.cacheStore).toBeDefined();
    expect(result.kind).toBe('new-year');
    expect(result.year).toBe(2027);
    expect(result.data.subjectName).toBe('스마트 구매자');
    expect(result.data.reportNo).toMatch(/^GS-EXT-NY27-\d{8}-[A-F0-9]{8}$/);
    expect(isNewYearReportNo(result.data.reportNo)).toBe(true);
    expect(result.interpretation.opening).toBe('올해는 차분하게 기반을 다지는 해입니다.');
    expect(result.generationSource).toBe('openai');
    expect(result.generationWarning).toBeUndefined();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it('warns before delivery when the generator fell back', async () => {
    vi.mocked(generateYearlyInterpretation).mockImplementationOnce(async (request) => {
      const reading = request.readingRecord!;
      const report = buildYearlyReport(reading.input, reading.sajuData, request.targetYear);
      return { report, interpretation: buildFallbackYearlyInterpretation(report, 'female'), source: 'fallback' } as unknown as YearlyInterpretationResponsePayload;
    });
    const parsed = parseExternalReportRequest(draft);
    if (!parsed.ok) throw new Error(parsed.error);
    const result = await generateExternalNewYearReport(parsed.input);
    expect(result.generationWarning).toContain('기본 계산 풀이');
    expect(isNewYearReportNo('GS-EXT-20261010-ABCDEF12')).toBe(false);
  });
});
