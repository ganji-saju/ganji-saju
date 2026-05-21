import assert from 'node:assert/strict';
import type { OhaengChartData } from '@/lib/saju-score';
import {
  buildOhaengGuidanceCacheKey,
  isOhaengGuidanceLLMEnabled,
  OHAENG_GUIDANCE_PROMPT_VERSION,
} from './ohaeng-guidance-cache';
import { buildOhaengGuidanceInput } from './ohaeng-guidance-content';

// 2026-05-21 — 오행 가이드 캐시 키 + env 플래그(Phase 5). total-review-cache 패턴.

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

test('buildOhaengGuidanceCacheKey: 결정론(동일 입력=동일 sha256)', () => {
  const a = buildOhaengGuidanceCacheKey(buildOhaengGuidanceInput(chart()));
  const b = buildOhaengGuidanceCacheKey(buildOhaengGuidanceInput(chart()));
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('buildOhaengGuidanceCacheKey: counts 다르면 다른 키', () => {
  const a = buildOhaengGuidanceCacheKey(buildOhaengGuidanceInput(chart()));
  const b = buildOhaengGuidanceCacheKey(
    buildOhaengGuidanceInput(chart({ counts: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 }, lack: [], excess: [] }))
  );
  assert.notEqual(a, b);
});

test('isOhaengGuidanceLLMEnabled: OPENAI_INTERPRET_OHAENG_GUIDANCE=1 만 true', () => {
  assert.equal(isOhaengGuidanceLLMEnabled({ OPENAI_INTERPRET_OHAENG_GUIDANCE: '1' } as unknown as NodeJS.ProcessEnv), true);
  assert.equal(isOhaengGuidanceLLMEnabled({} as unknown as NodeJS.ProcessEnv), false);
  assert.equal(isOhaengGuidanceLLMEnabled({ OPENAI_INTERPRET_OHAENG_GUIDANCE: '0' } as unknown as NodeJS.ProcessEnv), false);
});

test('OHAENG_GUIDANCE_PROMPT_VERSION: 정의됨', () => {
  assert.ok(OHAENG_GUIDANCE_PROMPT_VERSION.length > 0);
});
