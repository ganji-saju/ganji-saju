// 2026-09-26 — 신년운세 부가 단계(newyear): full 티어 요청일 때만 생성하고, basic 이 먼저 만든 캐시엔 부가 단계만 붙인다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTransientReading } from '@/lib/saju/readings';

vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseServiceEnv: false, hasSupabaseServerEnv: false,
  createClient: vi.fn(),
  createServiceClient: vi.fn(() => { throw new Error('unexpected DB access'); }),
}));
vi.mock('@/lib/saju/readings', async (original) => ({
  ...await original<typeof import('@/lib/saju/readings')>(), resolveReading: vi.fn(),
}));
vi.mock('@/server/classics/reading-grounding', async (original) => ({
  ...await original<typeof import('@/server/classics/reading-grounding')>(),
  getClassicReadingGrounding: vi.fn(async () => ({ version: 'v', status: 'retrieved', limitation: '', items: [] })),
}));
vi.mock('./openai-text', async (original) => ({
  ...await original<typeof import('./openai-text')>(), generateAiText: vi.fn(), getOpenAIInterpretationModel: () => 'test-model',
}));
vi.mock('./llm-telemetry', async (original) => ({
  ...await original<typeof import('./llm-telemetry')>(), recordLlmRun: vi.fn(async () => undefined),
}));

import { resolveReading } from '@/lib/saju/readings';
import { generateAiText } from './openai-text';
import { createInMemoryYearlyCacheStore, generateYearlyInterpretation } from './saju-yearly-service';
import { SAJU_NEW_YEAR_EXTRAS_PROMPT_VERSION } from './saju-yearly-interpretation';

const input = { name: '검증용', year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' as const };
const goodExtras = {
  categories: { family: '가족 문단입니다.', study: '학업 문단입니다.' },
  quarterlyFlows: [1, 2, 3, 4].map((q) => ({ quarter: q, summary: `${q}분기 요약입니다.`, focusCategory: 'wealth' })),
  expectations: [3, 5, 9].map((m) => ({ month: m, category: 'family', text: `${m}월 기대할 일` })),
  cautions: [2, 7, 11].map((m) => ({ month: m, category: 'health', text: `${m}월 조심할 일` })),
};
const isNewYearStage = (instructions: string) => instructions.includes('categories(family, study)');

describe('yearly service — newyear 부가 단계', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveReading).mockResolvedValue(buildTransientReading(input, 'fixture-identity'));
    // narrative·monthly 는 openai 성공(폴백 JSON 을 그대로 돌려줌), newyear 는 정상 JSON.
    vi.mocked(generateAiText).mockImplementation(async (request) => ({
      source: 'openai', model: 'test-model', fallbackReason: null, errorMessage: null,
      text: isNewYearStage(request.instructions) ? JSON.stringify(goodExtras) : request.fallbackText,
    }));
  });

  const calls = () => vi.mocked(generateAiText).mock.calls.map(([r]) => (isNewYearStage(r.instructions) ? 'newyear' : 'base'));

  it('basic(includeNewYear 없음)은 2단계만, newYear 없음', async () => {
    const r = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, cacheStore: createInMemoryYearlyCacheStore() });
    expect(calls()).toEqual(['base', 'base']);
    expect(r?.interpretation.newYear).toBeUndefined();
  });

  it('full 은 3단계, newYear 가 붙고 캐시에도 저장된다', async () => {
    const store = createInMemoryYearlyCacheStore();
    const r = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: store });
    expect(calls().sort()).toEqual(['base', 'base', 'newyear']);
    expect(r?.interpretation.newYear?.expectations[0].category).toBe('family');
    expect(r?.interpretation.newYear?._version).toBe(SAJU_NEW_YEAR_EXTRAS_PROMPT_VERSION);
  });

  it('basic 이 먼저 만든 캐시 → full 요청은 newyear 단계만 추가하고 캐시를 갱신한다', async () => {
    const store = createInMemoryYearlyCacheStore();
    const basic = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, cacheStore: store });
    vi.mocked(generateAiText).mockClear();
    const full = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: store });
    expect(calls()).toEqual(['newyear']);
    expect(full?.cached).toBe(true);
    expect(full?.interpretation.opening).toBe(basic?.interpretation.opening);
    expect(full?.interpretation.newYear).toBeDefined();
    vi.mocked(generateAiText).mockClear();
    const again = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: store });
    expect(calls()).toEqual([]);
    expect(again?.interpretation.newYear).toBeDefined();
  });

  it('newyear 단계 LLM 실패 → 결정론 폴백으로 채운다(빈 섹션 없음)', async () => {
    vi.mocked(generateAiText).mockImplementation(async (request) => ({
      source: isNewYearStage(request.instructions) ? 'fallback' : 'openai', model: null,
      fallbackReason: isNewYearStage(request.instructions) ? 'openai_error' : null, errorMessage: null,
      text: request.fallbackText,
    }));
    const r = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: createInMemoryYearlyCacheStore() });
    const ny = r?.interpretation.newYear;
    expect(ny?.quarterlyFlows).toHaveLength(4);
    expect(ny?.expectations.length).toBeGreaterThanOrEqual(3);
    expect(ny?.categories.family).toBeTruthy();
  });
});

// 2026-09-27 사용자 결정 — "볼 때마다 내용이 다르면 실망한다": 신년운세(full)는 처음 만든 풀이를 고정한다.
//   AI 가 일부 실패해 폴백이 섞여도 캐시에 저장하고, 부가 단계도 다시 만들지 않는다(화면·PDF·재방문이 같은 글).
describe('yearly service — 신년운세 풀이는 한 번 만들면 고정', () => {
  it('부가 단계가 폴백이어도 저장되고, 다음 full 요청은 AI 를 다시 부르지 않고 같은 글을 준다', async () => {
    vi.clearAllMocks();
    vi.mocked(resolveReading).mockResolvedValue(buildTransientReading(input, 'fixture-identity'));
    vi.mocked(generateAiText).mockImplementation(async (request) => {
      const ny = isNewYearStage(request.instructions);
      return ny
        ? { source: 'fallback', model: null, fallbackReason: 'openai_error', errorMessage: null, text: request.fallbackText }
        : { source: 'openai', model: 'test-model', fallbackReason: null, errorMessage: null, text: request.fallbackText };
    });
    const store = createInMemoryYearlyCacheStore();
    const first = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: store });
    vi.mocked(generateAiText).mockClear();
    const second = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: store });
    expect(vi.mocked(generateAiText).mock.calls).toHaveLength(0);
    expect(second?.interpretation).toEqual(first?.interpretation);
  });

  it('본문 단계가 폴백이어도(full) 저장돼 다음 요청이 같은 글을 준다', async () => {
    vi.clearAllMocks();
    vi.mocked(resolveReading).mockResolvedValue(buildTransientReading(input, 'fixture-identity'));
    vi.mocked(generateAiText).mockImplementation(async (request) => ({
      source: 'fallback', model: null, fallbackReason: 'openai_error', errorMessage: null, text: request.fallbackText,
    }));
    const store = createInMemoryYearlyCacheStore();
    const first = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: store });
    vi.mocked(generateAiText).mockClear();
    const second = await generateYearlyInterpretation({ readingIdentifier: 'fixture', targetYear: 2027, includeNewYear: true, cacheStore: store });
    expect(vi.mocked(generateAiText).mock.calls).toHaveLength(0);
    expect(second?.cached).toBe(true);
    expect(second?.interpretation).toEqual(first?.interpretation);
  });
});
