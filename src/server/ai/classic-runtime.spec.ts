import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { ClassicReadingGrounding } from '@/server/classics/reading-grounding';
import { buildTransientReading } from '@/lib/saju/readings';
import { buildTodayFortuneFreeResult, buildTodayFortunePremiumResult } from '@/server/today-fortune/build-today-fortune';

vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseServiceEnv: false, hasSupabaseServerEnv: false,
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) } })),
  createServiceClient: vi.fn(() => { throw new Error('unexpected DB access'); }),
}));
vi.mock('@/lib/saju/readings', async (original) => ({
  ...await original<typeof import('@/lib/saju/readings')>(), resolveReading: vi.fn(),
}));
vi.mock('@/server/classics/reading-grounding', async (original) => ({
  ...await original<typeof import('@/server/classics/reading-grounding')>(), getClassicReadingGrounding: vi.fn(),
}));
vi.mock('./openai-text', async (original) => ({
  ...await original<typeof import('./openai-text')>(), generateAiText: vi.fn(), isOpenAIConfigured: vi.fn(() => true),
}));
vi.mock('./llm-telemetry', async (original) => ({
  ...await original<typeof import('./llm-telemetry')>(), recordLlmRun: vi.fn(async () => undefined),
}));
vi.mock('./today-fortune/cache', async (original) => ({
  ...await original<typeof import('./today-fortune/cache')>(),
  readTodayFortuneAi: vi.fn(async () => null), writeTodayFortuneAi: vi.fn(async () => undefined),
}));

import { getClassicReadingGrounding } from '@/server/classics/reading-grounding';
import { resolveReading } from '@/lib/saju/readings';
import { generateAiText } from './openai-text';
import { generateTotalReview } from './saju-total-review-service';
import { createInMemoryTotalReviewCacheStore } from './total-review/total-review-cache-store';
import { generateLifetimeInterpretation } from './saju-lifetime-service';
import { createInMemoryLifetimeCacheStore } from './lifetime/lifetime-cache-store';
import { createInMemoryLlmTelemetryStore } from './llm-telemetry';
import { generateYearlyInterpretation } from './saju-yearly-service';
import { generateTodayFortuneNarrative } from './today-fortune/service';
import { readTodayFortuneAi } from './today-fortune/cache';
import { attachTodayPremiumNarrative } from './today-premium-service';
import { POST as interpret } from '@/app/api/interpret/route';

const classic: ClassicReadingGrounding = {
  version: 'fixture-v1', status: 'retrieved', limitation: '전통 해석이며 사건 예측이 아닙니다.',
  items: [{ ruleId: 'test-month-context', sourceTitle: '원문 검증용 자료',
    sourceUrl: 'https://example.com/source', passageId: 'fixture-passage-123', original: 'fixture original',
    meaning: '월령을 함께 살피는 편집 해설', matchedFacts: ['월지 계산값 확인'],
    limits: ['직업 확정 금지'], application: '역할과 조건을 비교', origin: 'corpus', verification: 'provisional', license: 'public-domain' }],
};
const input = { name: '검증용 가상인물', year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' as const };
const now = new Date('2026-09-18T03:00:00Z');
function fixture() { return buildTransientReading(input, 'fixture-identity'); }
function assertPrompt(prompt: { instructions: string; input: string }) {
  expect(prompt.instructions).toContain('classicGrounding');
  expect(prompt.input).toContain('fixture-passage-123');
  expect(prompt.input).toContain('월지 계산값 확인');
  expect(prompt.input).toContain('직업 확정 금지');
}

describe('classic evidence reaches actual generation entry points without paid calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_INTERPRET_CHAPTERS', '0');
    vi.mocked(getClassicReadingGrounding).mockResolvedValue(classic);
    vi.mocked(resolveReading).mockResolvedValue(fixture());
    vi.mocked(generateAiText).mockImplementation(async (request) => ({
      source: 'fallback', text: request.fallbackText, model: null,
      fallbackReason: 'ai_not_configured', errorMessage: 'offline test',
    }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('basic total review shares one lookup across three prompts and changes cache identity with source contents', async () => {
    const reading = fixture();
    const prompts: Array<{ instructions: string; input: string }> = [];
    const args = {
      sajuData: reading.sajuData, personalizationContext: reading.grounding.personalizationContext,
      env: { NODE_ENV: 'test' as const, OPENAI_INTERPRET_TOTAL_REVIEW: '1' }, maxRetries: 0,
      cacheStore: createInMemoryTotalReviewCacheStore(),
      client: { generate: async (instructions: string, input: string) => { prompts.push({ instructions, input }); return '{}'; } },
    };
    const first = await generateTotalReview(args);
    expect(getClassicReadingGrounding).toHaveBeenCalledTimes(1);
    expect(prompts).toHaveLength(3);
    prompts.forEach(assertPrompt);
    vi.mocked(getClassicReadingGrounding).mockResolvedValue({ ...classic, version: 'fixture-v2' });
    const second = await generateTotalReview(args);
    expect(second.meta.cacheKey).not.toBe(first.meta.cacheKey);
  });

  it('lifetime final and all enabled chapters share a single lookup', async () => {
    vi.stubEnv('OPENAI_INTERPRET_CHAPTERS', '1');
    vi.stubEnv('OPENAI_INTERPRET_CHAPTER_IDS', '1-9');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const reading = fixture();
    await generateLifetimeInterpretation({ readingIdentifier: reading.id, readingRecord: reading,
      targetYear: 2026, cacheStore: createInMemoryLifetimeCacheStore(), telemetryStore: createInMemoryLlmTelemetryStore() });
    expect(getClassicReadingGrounding).toHaveBeenCalledTimes(1);
    const prompts = vi.mocked(generateAiText).mock.calls.map(([request]) => request);
    expect(prompts.filter((p) => p.feature === 'lifetime')).toHaveLength(1);
    expect(prompts.filter((p) => p.feature === 'chapter').length).toBeGreaterThanOrEqual(8);
    prompts.forEach(assertPrompt);
  });

  it('general interpretation API retrieves evidence and forwards it with calculation facts', async () => {
    const response = await interpret(new Request('http://localhost/api/interpret', {
      method: 'POST', body: JSON.stringify({ readingId: 'fixture-reading' }), headers: { 'Content-Type': 'application/json' },
    }) as NextRequest);
    expect(response.status).toBe(200);
    expect(getClassicReadingGrounding).toHaveBeenCalledTimes(1);
    assertPrompt(vi.mocked(generateAiText).mock.calls[0][0]);
  });

  it('yearly narrative and monthly passes share one lookup and receive its limits', async () => {
    await generateYearlyInterpretation({ readingIdentifier: 'fixture-reading', targetYear: 2026 });
    expect(getClassicReadingGrounding).toHaveBeenCalledTimes(1);
    expect(getClassicReadingGrounding).toHaveBeenCalledWith(expect.anything(), 'yearly');
    const prompts = vi.mocked(generateAiText).mock.calls.map(([request]) => request);
    expect(prompts).toHaveLength(2);
    prompts.forEach(assertPrompt);
  });

  it('today free and paid receive daily-scoped evidence; free cache changes with evidence', async () => {
    vi.stubEnv('OPENAI_TODAY_FORTUNE', '1');
    const reading = fixture();
    const free = buildTodayFortuneFreeResult(reading.input, reading.sajuData, { concernId: 'money_spend', sourceSessionId: 'fixture', calendarType: 'solar', timeRule: 'standard', now });
    const premium = buildTodayFortunePremiumResult(reading.input, reading.sajuData, 'money_spend', reading.grounding, reading.kasiComparison, { now });
    const args = { result: free, sajuData: reading.sajuData, caseSummaries: [], situation: null, userId: 'fixture-user', subjectKey: 'fixture' };
    await generateTodayFortuneNarrative(args);
    assertPrompt(vi.mocked(generateAiText).mock.calls[0][0]);
    const firstVersion = vi.mocked(readTodayFortuneAi).mock.calls[0][0].promptVersion;
    vi.mocked(getClassicReadingGrounding).mockResolvedValue({ ...classic, version: 'fixture-v2' });
    await generateTodayFortuneNarrative(args);
    expect(vi.mocked(readTodayFortuneAi).mock.calls[1][0].promptVersion).not.toBe(firstVersion);
    await attachTodayPremiumNarrative(free, premium, { sajuData: reading.sajuData, userId: 'fixture-user', env: { NODE_ENV: 'test', OPENAI_INTERPRET_TODAY_PREMIUM: '1' } });
    assertPrompt(vi.mocked(generateAiText).mock.calls.at(-1)![0]);
    expect(getClassicReadingGrounding).toHaveBeenLastCalledWith(reading.sajuData, 'daily');
  });
});
