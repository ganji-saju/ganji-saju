import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SYSTEM_GUIDE_STORAGE_KEY,
  createDefaultSystemGuideState,
  normalizeSystemGuideState,
  readSystemGuideState,
  readSystemGuideStateResult,
  writeSystemGuideState,
  tryWriteSystemGuideState,
} from './system-guide-state';

const DEFAULT_STATE = { version: 1, status: 'new', stepIndex: 0 } as const;

test('default state starts a version 1 guide at the first step', () => {
  assert.equal(SYSTEM_GUIDE_STORAGE_KEY, 'ganji-saju:system-guide:v1');
  assert.deepEqual(createDefaultSystemGuideState(), DEFAULT_STATE);
});

test('normalization recovers invalid values and clamps valid step indexes', () => {
  for (const value of [
    null,
    undefined,
    {},
    { version: 2, status: 'new', stepIndex: 0 },
    { version: 1, status: 'unknown', stepIndex: 0 },
    { version: 1, status: 'new', stepIndex: Number.NaN },
  ]) {
    assert.deepEqual(normalizeSystemGuideState(value), DEFAULT_STATE);
  }

  assert.deepEqual(normalizeSystemGuideState({ version: 1, status: 'in_progress', stepIndex: -3 }), {
    version: 1,
    status: 'in_progress',
    stepIndex: 0,
  });
  assert.deepEqual(normalizeSystemGuideState({ version: 1, status: 'completed', stepIndex: 12 }), {
    version: 1,
    status: 'completed',
    stepIndex: 5,
  });
});

test('reading storage recovers null, broken JSON, and access errors', () => {
  assert.deepEqual(readSystemGuideState({ getItem: () => null }), DEFAULT_STATE);
  assert.deepEqual(readSystemGuideState({ getItem: () => '{broken' }), DEFAULT_STATE);
  assert.deepEqual(
    readSystemGuideState({
      getItem: () => {
        throw new Error('privacy mode');
      },
    }),
    DEFAULT_STATE,
  );
});

test('result storage APIs distinguish unavailable access from recoverable content', () => {
  assert.deepEqual(readSystemGuideStateResult({ getItem: () => null }), {
    available: true,
    state: DEFAULT_STATE,
  });
  assert.deepEqual(readSystemGuideStateResult({ getItem: () => '{broken' }), {
    available: true,
    state: DEFAULT_STATE,
  });
  assert.deepEqual(
    readSystemGuideStateResult({ getItem: () => { throw new Error('privacy mode'); } }),
    { available: false, state: DEFAULT_STATE },
  );
  assert.equal(
    tryWriteSystemGuideState(
      { setItem: () => { throw new Error('privacy mode'); } },
      DEFAULT_STATE,
    ),
    false,
  );
});

test('storage round-trips normalized state under the versioned key', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };

  writeSystemGuideState(storage, { version: 1, status: 'in_progress', stepIndex: 3 });

  assert.deepEqual(readSystemGuideState(storage), {
    version: 1,
    status: 'in_progress',
    stepIndex: 3,
  });
  assert.equal(values.has(SYSTEM_GUIDE_STORAGE_KEY), true);
});
