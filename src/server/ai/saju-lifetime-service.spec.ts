import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLifetimeReport } from '@/domain/saju/report';
import { buildTransientReading } from '@/lib/saju/readings';
import { buildFallbackLifetimeInterpretation } from './saju-lifetime-interpretation';
import { createInMemoryLifetimeCacheStore } from './lifetime/lifetime-cache-store';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => { throw new Error('unexpected database access'); }),
  createServiceClient: vi.fn(() => { throw new Error('unexpected database access'); }),
  hasSupabaseServiceEnv: true,
}));
vi.mock('@/server/ai/openai-text', async (original) => ({
  ...await original<typeof import('./openai-text')>(),
  isOpenAIConfigured: vi.fn(() => true),
  generateAiText: vi.fn(),
}));
vi.mock('@/server/ai/llm-telemetry', async (original) => ({
  ...await original<typeof import('./llm-telemetry')>(),
  recordLlmRun: vi.fn(async () => undefined),
}));

import { createServiceClient } from '@/lib/supabase/server';
import { generateAiText } from './openai-text';
import { createInMemoryLlmTelemetryStore, recordLlmRun } from './llm-telemetry';
import { generateLifetimeInterpretation } from './saju-lifetime-service';

const input = { name: '외부 구매자', year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' as const };

describe('lifetime generation isolated persistence and budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_INTERPRET_CHAPTERS', '1');
    vi.stubEnv('OPENAI_INTERPRET_CHAPTER_IDS', '1-9');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(generateAiText).mockImplementation(async (request) => ({
      source: 'fallback', text: request.fallbackText, model: null,
      fallbackReason: 'ai_not_configured', errorMessage: 'offline fixture',
    }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('passes the isolated telemetry store to every chapter retry and final generation', async () => {
    const reading = buildTransientReading(input, 'external-report-test');
    const telemetryStore = createInMemoryLlmTelemetryStore();
    const result = await generateLifetimeInterpretation({
      readingIdentifier: reading.id, readingRecord: reading, targetYear: 2026,
      cacheStore: createInMemoryLifetimeCacheStore(), telemetryStore, deadlineAt: Date.now() + 240_000,
    });
    expect(result?.source).toBe('fallback');
    const calls = vi.mocked(generateAiText).mock.calls.map(([request]) => request);
    expect(calls.filter((request) => request.feature === 'chapter')).toHaveLength(24);
    expect(calls.filter((request) => request.feature === 'lifetime')).toHaveLength(1);
    expect(calls.find((request) => request.feature === 'lifetime')?.maxOutputTokens).toBe(4800);
    for (const request of calls) expect(request.telemetryStore).toBe(telemetryStore);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it('passes the same isolated store to cache-hit telemetry', async () => {
    vi.stubEnv('OPENAI_INTERPRET_CHAPTERS', '0');
    const reading = buildTransientReading(input, 'external-report-test');
    const report = buildLifetimeReport(reading.input, reading.sajuData, 2026);
    const telemetryStore = createInMemoryLlmTelemetryStore();
    const result = await generateLifetimeInterpretation({
      readingIdentifier: reading.id, readingRecord: reading, targetYear: 2026, telemetryStore,
      cacheStore: {
        get: async () => ({ output: buildFallbackLifetimeInterpretation(report, 'female'), model: 'fixture', generatedAt: new Date().toISOString() }),
        set: vi.fn(),
      },
    });
    expect(result?.cached).toBe(true);
    expect(recordLlmRun).toHaveBeenCalledWith(expect.objectContaining({ feature: 'lifetime', source: 'cache', userId: null }), telemetryStore);
    expect(generateAiText).not.toHaveBeenCalled();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it('an elapsed budget prevents all paid calls and honestly returns fallback', async () => {
    const reading = buildTransientReading(input, 'external-report-test');
    const result = await generateLifetimeInterpretation({
      readingIdentifier: reading.id, readingRecord: reading, targetYear: 2026,
      cacheStore: createInMemoryLifetimeCacheStore(), telemetryStore: createInMemoryLlmTelemetryStore(), deadlineAt: Date.now() - 1,
    });
    expect(generateAiText).not.toHaveBeenCalled();
    expect(result?.source).toBe('fallback');
    expect(result?.errorMessage).toContain('제한 시간');
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it('cancellation after a chapter call prevents retries, later chapters and final generation', async () => {
    const controller = new AbortController();
    vi.mocked(generateAiText).mockImplementationOnce(async () => {
      controller.abort();
      return { source: 'fallback', text: '', model: null, fallbackReason: 'openai_error', errorMessage: 'cancelled fixture' };
    });
    const reading = buildTransientReading(input, 'external-report-test');
    await expect(generateLifetimeInterpretation({
      readingIdentifier: reading.id, readingRecord: reading, targetYear: 2026,
      cacheStore: createInMemoryLifetimeCacheStore(), telemetryStore: createInMemoryLlmTelemetryStore(), signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(generateAiText).toHaveBeenCalledOnce();
    expect(vi.mocked(generateAiText).mock.calls[0][0].signal).toBe(controller.signal);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});
