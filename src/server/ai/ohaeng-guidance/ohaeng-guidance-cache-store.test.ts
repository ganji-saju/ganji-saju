import assert from 'node:assert/strict';
import { createInMemoryOhaengGuidanceCacheStore } from './ohaeng-guidance-cache-store';

// 2026-05-21 — 오행 가이드 캐시 스토어(캐시 후속). in-memory get/set 라운드트립.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('InMemoryOhaengGuidanceCacheStore: set 후 get 라운드트립', async () => {
  const store = createInMemoryOhaengGuidanceCacheStore();
  assert.equal(await store.get('k1'), null);
  await store.set('k1', { guidanceText: '토 기운이 강한 사주예요.' });
  const got = await store.get('k1');
  assert.ok(got);
  assert.equal(got?.guidanceText, '토 기운이 강한 사주예요.');
  assert.ok(got?.generatedAt);
});

test('InMemoryOhaengGuidanceCacheStore: 미존재 키 null', async () => {
  const store = createInMemoryOhaengGuidanceCacheStore();
  assert.equal(await store.get('nope'), null);
});
