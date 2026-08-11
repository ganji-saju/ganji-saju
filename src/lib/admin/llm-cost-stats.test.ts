import assert from 'node:assert/strict';
import {
  aggregateByDay,
  aggregateByFeature,
  overallSummary,
  rowCostUsd,
} from './llm-cost-stats';

// 2026-05-25 Phase 3 — ai_llm_runs 집계 순수 로직.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const rows = [
  { created_at: '2026-05-24T10:00:00Z', feature: 'lifetime', source: 'openai', model: 'gpt-5.2', input_tokens: 3000, output_tokens: 2000, cost_usd: 0.02, user_id_hash: 'u1' },
  { created_at: '2026-05-24T11:00:00Z', feature: 'lifetime', source: 'cache', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: 'u2' },
  { created_at: '2026-05-25T09:00:00Z', feature: 'chat', source: 'openai', model: 'gpt-5.2', input_tokens: 500, output_tokens: 300, cost_usd: 0.004, user_id_hash: 'u1' },
  { created_at: '2026-05-25T09:30:00Z', feature: 'chat', source: 'fallback', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: null },
];

test('aggregateByDay: 날짜별 호출·비용·고유사용자(오름차순)', () => {
  const days = aggregateByDay(rows);
  assert.equal(days.length, 2);
  assert.equal(days[0].date, '2026-05-24');
  assert.equal(days[0].calls, 2);
  assert.equal(days[0].costUsd, 0.02375); // 저장값 0.02 가 아니라 model 단가로 재계산
  assert.equal(days[0].distinctUsers, 2); // u1, u2
  assert.equal(days[1].date, '2026-05-25');
  assert.equal(days[1].calls, 2);
  assert.equal(days[1].costUsd, 0.003625);
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
  assert.equal(feats[0].costUsd, 0.02375);
  const chat = feats.find((f) => f.feature === 'chat');
  assert.equal(chat?.fallback, 1);
  assert.equal(chat?.cacheHitRate, 0);
});

test('overallSummary: 전체 합·고유사용자·hit률', () => {
  const s = overallSummary(rows);
  assert.equal(s.totalCalls, 4);
  assert.equal(s.totalCostUsd, 0.027375);
  assert.equal(s.distinctUsers, 2); // u1, u2 (null 제외)
  assert.equal(s.cacheHitRate, 0.25); // cache 1 / 4
});

test('aggregateByDay: KST 날짜 버킷 — UTC 15시 이후는 KST 다음날', () => {
  // 2026-05-24T16:00Z = KST 05-25 01:00 → '2026-05-25' 버킷이어야 한다(UTC slice 였으면 05-24).
  const boundary = [
    { created_at: '2026-05-24T14:59:00Z', feature: 'chat', source: 'openai', input_tokens: 1, output_tokens: 1, cost_usd: 0.001, user_id_hash: 'u1' },
    { created_at: '2026-05-24T16:00:00Z', feature: 'chat', source: 'openai', input_tokens: 1, output_tokens: 1, cost_usd: 0.001, user_id_hash: 'u1' },
  ];
  const days = aggregateByDay(boundary);
  assert.equal(days.length, 2);
  assert.equal(days[0].date, '2026-05-24'); // 14:59Z = KST 23:59
  assert.equal(days[1].date, '2026-05-25'); // 16:00Z = KST 익일 01:00
});

test('aggregate: 빈 배열 안전', () => {
  assert.deepEqual(aggregateByDay([]), []);
  assert.deepEqual(aggregateByFeature([]), []);
  assert.equal(overallSummary([]).totalCalls, 0);
  assert.equal(overallSummary([]).cacheHitRate, 0);
});

// 2026-08-11 — 단가표 변경이 대시보드에 즉시 반영되는지 (저장된 cost_usd 무시)
test('rowCostUsd: 저장값이 틀려도 현재 단가표로 재계산한다', () => {
  const stale = {
    created_at: '2026-08-11T00:00:00Z', feature: 'chat', source: 'openai',
    model: 'gpt-5.6-luna', input_tokens: 1_000_000, output_tokens: 1_000_000,
    cost_usd: 99, user_id_hash: null,
  };
  // luna = 입력 $0.20 / 출력 $1.20 per 1M → 1.4 (저장된 99 를 쓰지 않는다)
  assert.equal(rowCostUsd(stale), 1.4);
});

test('rowCostUsd: 토큰 없는 행(cache·fallback)은 저장값을 그대로 쓴다', () => {
  assert.equal(
    rowCostUsd({ created_at: 'x', feature: 'chat', source: 'cache',
      model: null, input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: null }),
    0
  );
});
