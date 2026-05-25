import assert from 'node:assert/strict';
import {
  aggregateByDay,
  aggregateByFeature,
  overallSummary,
} from './llm-cost-stats';

// 2026-05-25 Phase 3 — ai_llm_runs 집계 순수 로직.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const rows = [
  { created_at: '2026-05-24T10:00:00Z', feature: 'lifetime', source: 'openai', input_tokens: 3000, output_tokens: 2000, cost_usd: 0.02, user_id_hash: 'u1' },
  { created_at: '2026-05-24T11:00:00Z', feature: 'lifetime', source: 'cache', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: 'u2' },
  { created_at: '2026-05-25T09:00:00Z', feature: 'chat', source: 'openai', input_tokens: 500, output_tokens: 300, cost_usd: 0.004, user_id_hash: 'u1' },
  { created_at: '2026-05-25T09:30:00Z', feature: 'chat', source: 'fallback', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: null },
];

test('aggregateByDay: 날짜별 호출·비용·고유사용자(오름차순)', () => {
  const days = aggregateByDay(rows);
  assert.equal(days.length, 2);
  assert.equal(days[0].date, '2026-05-24');
  assert.equal(days[0].calls, 2);
  assert.equal(days[0].costUsd, 0.02);
  assert.equal(days[0].distinctUsers, 2); // u1, u2
  assert.equal(days[1].date, '2026-05-25');
  assert.equal(days[1].calls, 2);
  assert.equal(days[1].costUsd, 0.004);
  assert.equal(days[1].distinctUsers, 1); // u1 (null 제외)
});

test('aggregateByFeature: 영역별 source 카운트·hit률·토큰·비용(비용 내림차순)', () => {
  const feats = aggregateByFeature(rows);
  assert.equal(feats[0].feature, 'lifetime'); // 비용 큰 순
  assert.equal(feats[0].calls, 2);
  assert.equal(feats[0].openai, 1);
  assert.equal(feats[0].cache, 1);
  assert.equal(feats[0].fallback, 0);
  assert.equal(feats[0].cacheHitRate, 0.5);
  assert.equal(feats[0].inputTokens, 3000);
  assert.equal(feats[0].outputTokens, 2000);
  assert.equal(feats[0].costUsd, 0.02);
  const chat = feats.find((f) => f.feature === 'chat');
  assert.equal(chat?.fallback, 1);
  assert.equal(chat?.cacheHitRate, 0);
});

test('overallSummary: 전체 합·고유사용자·hit률', () => {
  const s = overallSummary(rows);
  assert.equal(s.totalCalls, 4);
  assert.equal(s.totalCostUsd, 0.024);
  assert.equal(s.distinctUsers, 2); // u1, u2 (null 제외)
  assert.equal(s.cacheHitRate, 0.25); // cache 1 / 4
});

test('aggregate: 빈 배열 안전', () => {
  assert.deepEqual(aggregateByDay([]), []);
  assert.deepEqual(aggregateByFeature([]), []);
  assert.equal(overallSummary([]).totalCalls, 0);
  assert.equal(overallSummary([]).cacheHitRate, 0);
});
