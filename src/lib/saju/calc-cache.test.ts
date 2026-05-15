// 2026-05-16 PR #139 — calculateSaju 캐시 검증.
import assert from 'node:assert/strict';
import { cachedCalculateSaju, clearCalcCache, getCacheStats } from './calc-cache';
import type { BirthInput } from './types';

declare const test: (name: string, fn: () => void) => void;

const baseInput: BirthInput = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 12,
  minute: 0,
  gender: 'male',
  unknownTime: false,
};

test('cachedCalculateSaju - 캐시 hit 시 같은 객체 반환', () => {
  clearCalcCache();
  const a = cachedCalculateSaju(baseInput);
  const b = cachedCalculateSaju(baseInput);
  // 동일 객체 — 캐시에서 가져옴.
  assert.equal(a, b);
});

test('cachedCalculateSaju - 다른 입력은 다른 결과', () => {
  clearCalcCache();
  const a = cachedCalculateSaju(baseInput);
  const b = cachedCalculateSaju({ ...baseInput, day: 16 });
  // 다른 날짜 → 다른 SajuResult.
  assert.notEqual(a.dayMaster, b.dayMaster);
});

test('cachedCalculateSaju - hits / misses 카운트', () => {
  clearCalcCache();
  cachedCalculateSaju(baseInput); // miss
  cachedCalculateSaju(baseInput); // hit
  cachedCalculateSaju(baseInput); // hit
  cachedCalculateSaju({ ...baseInput, year: 1991 }); // miss
  const stats = getCacheStats();
  assert.equal(stats.misses, 2);
  assert.equal(stats.hits, 2);
  assert.ok(stats.hitRate === 0.5);
});

test('cachedCalculateSaju - 같은 입력 → 같은 결과 (값 동등)', () => {
  clearCalcCache();
  const a = cachedCalculateSaju(baseInput);
  clearCalcCache(); // 캐시 비우고 다시 계산
  const b = cachedCalculateSaju(baseInput);
  assert.equal(a.dayMaster, b.dayMaster);
  assert.equal(a.dominantElement, b.dominantElement);
});

test('clearCalcCache - hits/misses 모두 0', () => {
  cachedCalculateSaju(baseInput);
  cachedCalculateSaju(baseInput);
  clearCalcCache();
  const stats = getCacheStats();
  assert.equal(stats.hits, 0);
  assert.equal(stats.misses, 0);
  assert.equal(stats.size, 0);
});
