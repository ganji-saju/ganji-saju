import assert from 'node:assert/strict';
import type { OhaengChartData } from '@/lib/saju-score';
import type { ChapterLLMClient } from '../chapters/generate-chapter';
import { generateOhaengGuidance } from './generate-ohaeng-guidance';
import { createInMemoryOhaengGuidanceCacheStore } from './ohaeng-guidance-cache-store';
import { buildOhaengGuidanceCacheKey } from './ohaeng-guidance-cache';
import { buildOhaengGuidanceInput } from './ohaeng-guidance-content';

// 2026-05-21 — 오행 가이드 오케스트레이터(Phase 5). DI mock client 로 플래그/검증/fallback 검증.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function chart(overrides: Partial<OhaengChartData> = {}): OhaengChartData {
  return {
    counts: { 목: 1, 화: 1, 토: 4, 금: 2, 수: 0 },
    total: 8,
    labels: { 목: '목 기운', 화: '화 기운', 토: '토 기운', 금: '금 기운', 수: '수 기운' },
    meanings: {
      목: '자라남과 추진', 화: '표현과 열정', 토: '담아냄과 안정',
      금: '단단함과 결단', 수: '흐름과 깊이',
    },
    colors: { 목: '#10b981', 화: '#f43f5e', 토: '#f59e0b', 금: '#6b7280', 수: '#3b82f6' },
    lack: ['수'],
    excess: ['토'],
    balanceScore: 6,
    ...overrides,
  };
}

const ON = { OPENAI_INTERPRET_OHAENG_GUIDANCE: '1' } as unknown as NodeJS.ProcessEnv;
const OFF = {} as unknown as NodeJS.ProcessEnv;

const fixedClient = (text: string): ChapterLLMClient => ({
  async generate() {
    return text;
  },
});

test('generateOhaengGuidance: 플래그 OFF → fallback (LLM 미호출)', async () => {
  let called = false;
  const client: ChapterLLMClient = {
    async generate() {
      called = true;
      return 'x';
    },
  };
  const r = await generateOhaengGuidance({ chart: chart(), env: OFF, client, now: new Date('2026-05-21T00:00:00Z') });
  assert.equal(r.source, 'fallback');
  assert.equal(called, false, 'LLM 미호출이어야');
  assert.ok(r.guidanceText.includes('토 기운'));
  assert.match(r.meta.cacheKey, /^[0-9a-f]{64}$/);
  assert.equal(r.meta.promptVersion, 'ohaeng-guidance/v1');
});

test('generateOhaengGuidance: 플래그 ON + 정상 텍스트 → llm', async () => {
  const good =
    '토 기운이 도드라지는 사주예요. 안정의 힘을 살리면서 부족한 수 기운을 의식적으로 채워 주면 흐름이 한결 부드러워집니다.';
  const r = await generateOhaengGuidance({ chart: chart(), env: ON, client: fixedClient(good) });
  assert.equal(r.source, 'llm');
  assert.equal(r.guidanceText, good);
  assert.deepEqual(r.reasons, []);
});

test('generateOhaengGuidance: 플래그 ON + 한자 응답 → 재시도 후 fallback', async () => {
  const r = await generateOhaengGuidance({
    chart: chart(),
    env: ON,
    client: fixedClient('土 기운이 강한 사주예요. 안정의 힘을 살리세요.'),
    maxRetries: 1,
  });
  assert.equal(r.source, 'fallback');
  assert.ok(r.reasons.length > 0);
  assert.ok(r.guidanceText.includes('토 기운'), 'fallback 본문');
});

test('generateOhaengGuidance: 플래그 ON + LLM throw → fallback', async () => {
  const client: ChapterLLMClient = {
    async generate() {
      throw new Error('boom');
    },
  };
  const r = await generateOhaengGuidance({ chart: chart(), env: ON, client, maxRetries: 1 });
  assert.equal(r.source, 'fallback');
  assert.ok(r.guidanceText.length > 0);
});

test('generateOhaengGuidance: 플래그 ON + 너무 짧은 응답 → fallback', async () => {
  const r = await generateOhaengGuidance({ chart: chart(), env: ON, client: fixedClient('토 기운.'), maxRetries: 1 });
  assert.equal(r.source, 'fallback');
});

test('generateOhaengGuidance: 플래그 ON + 캐시 hit → cache (LLM 미호출)', async () => {
  const store = createInMemoryOhaengGuidanceCacheStore();
  const c = chart();
  const key = buildOhaengGuidanceCacheKey(buildOhaengGuidanceInput(c));
  await store.set(key, { guidanceText: '캐시된 가이드 본문이에요. 충분히 긴 텍스트로 채워 검증을 통과합니다.' });
  let called = false;
  const client: ChapterLLMClient = {
    async generate() {
      called = true;
      return 'x';
    },
  };
  const r = await generateOhaengGuidance({ chart: c, env: ON, client, cacheStore: store });
  assert.equal(r.source, 'cache');
  assert.equal(r.guidanceText, '캐시된 가이드 본문이에요. 충분히 긴 텍스트로 채워 검증을 통과합니다.');
  assert.equal(called, false, 'LLM 미호출이어야');
});

test('generateOhaengGuidance: 플래그 ON + miss + llm → 캐시에 저장', async () => {
  const store = createInMemoryOhaengGuidanceCacheStore();
  const good =
    '토 기운이 도드라지는 사주예요. 안정의 힘을 살리면서 부족한 수 기운을 의식적으로 채워 주면 흐름이 한결 부드러워집니다.';
  const c = chart();
  const r = await generateOhaengGuidance({ chart: c, env: ON, client: fixedClient(good), cacheStore: store });
  assert.equal(r.source, 'llm');
  const cached = await store.get(buildOhaengGuidanceCacheKey(buildOhaengGuidanceInput(c)));
  assert.ok(cached, 'llm 결과는 캐시에 저장');
  assert.equal(cached?.guidanceText, good);
});

test('generateOhaengGuidance: 플래그 ON + fallback(한자) → 캐시 미저장', async () => {
  const store = createInMemoryOhaengGuidanceCacheStore();
  const c = chart();
  const r = await generateOhaengGuidance({
    chart: c,
    env: ON,
    client: fixedClient('土 기운이 강한 사주예요. 안정의 힘을 살리세요.'),
    maxRetries: 0,
    cacheStore: store,
  });
  assert.equal(r.source, 'fallback');
  assert.equal(
    await store.get(buildOhaengGuidanceCacheKey(buildOhaengGuidanceInput(c))),
    null,
    'fallback 은 캐시하지 않음'
  );
});
