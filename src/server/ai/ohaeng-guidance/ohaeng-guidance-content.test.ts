import assert from 'node:assert/strict';
import type { OhaengChartData } from '@/lib/saju-score';
import {
  buildOhaengGuidanceInput,
  buildDeterministicOhaengGuidance,
} from './ohaeng-guidance-content';
import { validateOhaengGuidance } from './ohaeng-guidance-validator';

// 2026-05-21 — 오행 LLM 가이드(Phase 5) 입력 빌더 + 결정론 fallback.

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

test('buildOhaengGuidanceInput: chart → input (dominant=토, balanceLevel=low(F4 6))', () => {
  const input = buildOhaengGuidanceInput(chart());
  assert.equal(input.dominant, '토');
  assert.deepEqual(input.lack, ['수']);
  assert.equal(input.balanceLevel, 'low');
  assert.equal(input.labels['토'], '토 기운');
  assert.equal(input.balanceScore, 6);
});

test('buildDeterministicOhaengGuidance: 비어있지 않음 + 한자 0 + 도미넌트 라벨 포함 + validator 통과', () => {
  const text = buildDeterministicOhaengGuidance(buildOhaengGuidanceInput(chart()));
  assert.ok(text.length > 20, '충분한 길이');
  assert.ok(!/[一-鿿]/.test(text), '한자 0');
  assert.ok(text.includes('토 기운'), '도미넌트 라벨 포함');
  const v = validateOhaengGuidance(text);
  assert.ok(v.ok, `validator 통과해야: ${v.reasons.join(' / ')}`);
});

test('buildDeterministicOhaengGuidance: 균형 좋은(high) 케이스도 한자 0 + validator 통과', () => {
  const input = buildOhaengGuidanceInput(
    chart({ counts: { 목: 2, 화: 2, 토: 2, 금: 1, 수: 1 }, lack: [], excess: [], balanceScore: 17 })
  );
  const text = buildDeterministicOhaengGuidance(input);
  assert.ok(!/[一-鿿]/.test(text));
  const v = validateOhaengGuidance(text);
  assert.ok(v.ok, v.reasons.join(' / '));
});

test('buildDeterministicOhaengGuidance: 부족 기운 2개도 라벨로 표기 + validator 통과', () => {
  const input = buildOhaengGuidanceInput(
    chart({ counts: { 목: 0, 화: 3, 토: 3, 금: 2, 수: 0 }, lack: ['목', '수'], excess: [], balanceScore: 8 })
  );
  const text = buildDeterministicOhaengGuidance(input);
  assert.ok(text.includes('목 기운') && text.includes('수 기운'), '부족 라벨 포함');
  assert.ok(validateOhaengGuidance(text).ok);
});
