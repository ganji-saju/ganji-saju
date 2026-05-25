import assert from 'node:assert/strict';
import {
  buildLlmRunRecord,
  createInMemoryLlmTelemetryStore,
  estimateLlmCostUsd,
  hashUserId,
} from './llm-telemetry';
import { generateAiText } from './openai-text';

// 2026-05-25 Phase 0b — LLM 텔레메트리 순수 로직. chapter-telemetry 단가/해시 패턴 복제.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('estimateLlmCostUsd: 알려진 모델·토큰 → 단가표 계산', () => {
  // gpt-5.2: input 1.25/M, output 10/M. (2000*1.25 + 500*10)/1e6 = 0.0075
  assert.equal(estimateLlmCostUsd('gpt-5.2', 2000, 500), 0.0075);
});

test('estimateLlmCostUsd: 토큰 없으면 0', () => {
  assert.equal(estimateLlmCostUsd('gpt-5.2', undefined, undefined), 0);
  assert.equal(estimateLlmCostUsd('gpt-5.2', 100, undefined), 0);
});

test('estimateLlmCostUsd: 알 수 없는 모델 → default 단가', () => {
  // default = gpt-5.2 단가와 동일(1.25/10) → 같은 값
  assert.equal(estimateLlmCostUsd('unknown-model', 2000, 500), 0.0075);
});

test('hashUserId: 16자 16진수 + 일관성, null → undefined', () => {
  const h = hashUserId('user-123');
  assert.match(String(h), /^[0-9a-f]{16}$/);
  assert.equal(hashUserId('user-123'), h);
  assert.notEqual(hashUserId('user-456'), h);
  assert.equal(hashUserId(null), undefined);
  assert.equal(hashUserId(undefined), undefined);
});

test('buildLlmRunRecord: openai → cost 계산 + userIdHash 설정', () => {
  const r = buildLlmRunRecord({
    feature: 'lifetime',
    source: 'openai',
    model: 'gpt-5.2',
    inputTokens: 2000,
    outputTokens: 500,
    durationMs: 1234,
    userId: 'user-123',
  });
  assert.equal(r.feature, 'lifetime');
  assert.equal(r.source, 'openai');
  assert.equal(r.model, 'gpt-5.2');
  assert.equal(r.inputTokens, 2000);
  assert.equal(r.outputTokens, 500);
  assert.equal(r.costUsd, 0.0075);
  assert.equal(r.durationMs, 1234);
  assert.match(String(r.userIdHash), /^[0-9a-f]{16}$/);
  assert.equal(r.fallbackReason, null);
});

test('buildLlmRunRecord: cache → cost 0 (model 있어도)', () => {
  const r = buildLlmRunRecord({
    feature: 'total_review',
    source: 'cache',
    model: 'gpt-5.2-chat-latest',
    userId: 'user-123',
  });
  assert.equal(r.source, 'cache');
  assert.equal(r.costUsd, 0);
  assert.equal(r.model, 'gpt-5.2-chat-latest');
  assert.equal(r.inputTokens, null);
  assert.equal(r.outputTokens, null);
});

test('buildLlmRunRecord: fallback → fallbackReason 보존, cost 0(토큰 없음)', () => {
  const r = buildLlmRunRecord({
    feature: 'yearly',
    source: 'fallback',
    model: null,
    fallbackReason: 'quota_exceeded',
  });
  assert.equal(r.source, 'fallback');
  assert.equal(r.fallbackReason, 'quota_exceeded');
  assert.equal(r.costUsd, 0);
});

test('buildLlmRunRecord: 비로그인(userId 없음) → userIdHash null', () => {
  const r = buildLlmRunRecord({ feature: 'interpret', source: 'openai' });
  assert.equal(r.userIdHash, null);
});

test('generateAiText: feature 지정 시 telemetryStore 에 레코드 1건 (no key → fallback 경로)', async () => {
  const store = createInMemoryLlmTelemetryStore();
  const result = await generateAiText({
    instructions: 'x',
    input: 'y',
    fallbackText: 'fb',
    feature: 'interpret',
    telemetryStore: store,
  });
  assert.equal(result.source, 'fallback');
  assert.equal(store.records.length, 1);
  assert.equal(store.records[0].feature, 'interpret');
  assert.equal(store.records[0].source, 'fallback');
  assert.equal(store.records[0].fallbackReason, 'ai_not_configured');
});

test('generateAiText: feature 미지정 → telemetry skip(레코드 0)', async () => {
  const store = createInMemoryLlmTelemetryStore();
  await generateAiText({ instructions: 'x', input: 'y', fallbackText: 'fb', telemetryStore: store });
  assert.equal(store.records.length, 0);
});
