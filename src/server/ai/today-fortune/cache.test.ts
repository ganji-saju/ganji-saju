import assert from 'node:assert/strict';
import { buildTodayFortuneCacheInsert } from './cache';

declare const test: (name: string, fn: () => void) => void;

test('insert row 는 unique 키 컬럼 + 본문을 담는다', () => {
  const row = buildTodayFortuneCacheInsert(
    { userId: 'u1', dateKey: '2026-06-22', concernId: 'love', promptVersion: 'tf-v1' },
    { headline: 'h', body: 'b', source: 'openai', model: 'm', fallbackReason: null, iljinGanzi: '갑자' }
  );
  assert.equal(row.user_id, 'u1');
  assert.equal(row.date_key, '2026-06-22');
  assert.equal(row.concern_id, 'love');
  assert.equal(row.headline, 'h');
});

test('camelCase 값이 snake_case DB 컬럼으로 매핑된다', () => {
  const row = buildTodayFortuneCacheInsert(
    { userId: 'u2', dateKey: '2026-06-22', concernId: 'money', promptVersion: 'tf-v2' },
    { headline: 'title', body: 'content', source: 'fallback', model: null, fallbackReason: 'timeout', iljinGanzi: null }
  );
  assert.equal(row.prompt_version, 'tf-v2');
  assert.equal(row.body, 'content');
  assert.equal(row.source, 'fallback');
  assert.equal(row.model, null);
  assert.equal(row.fallback_reason, 'timeout');
  assert.equal(row.iljin_ganzi, null);
});
