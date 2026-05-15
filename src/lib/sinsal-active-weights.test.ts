// 2026-05-16 PR #140 — sinsal active weights 검증.
import assert from 'node:assert/strict';
import {
  __setActiveWeightsForTest,
  applyActiveSinsalWeights,
  getActiveWeightsSync,
} from './sinsal-active-weights';

declare const test: (name: string, fn: () => void) => void;

const sampleHits = [
  { name: '천을귀인', category: '길신', scoreHint: 15, hint: '' },
  { name: '백호살', category: '흉신', scoreHint: -12, hint: '' },
  { name: '미지신살', category: 'unknown', scoreHint: 0, hint: '' },
];

test('applyActiveSinsalWeights - active 없을 때 그대로', () => {
  __setActiveWeightsForTest(null);
  const result = applyActiveSinsalWeights(sampleHits);
  assert.deepEqual(result, sampleHits);
});

test('applyActiveSinsalWeights - active 있으면 scoreHint override', () => {
  __setActiveWeightsForTest({
    천을귀인: 18.5,
    백호살: -8.0,
  });
  const result = applyActiveSinsalWeights(sampleHits);
  assert.equal(result[0]!.scoreHint, 18.5);
  assert.equal(result[1]!.scoreHint, -8.0);
  // 학습 결과에 없는 신살은 hardcoded 유지.
  assert.equal(result[2]!.scoreHint, 0);
});

test('applyActiveSinsalWeights - 잘못된 값 (NaN/string) 은 무시', () => {
  __setActiveWeightsForTest({
    천을귀인: Number.NaN as unknown as number,
    백호살: -9,
  });
  const result = applyActiveSinsalWeights(sampleHits);
  // NaN 은 override 안 됨.
  assert.equal(result[0]!.scoreHint, 15);
  // 정상 숫자는 override.
  assert.equal(result[1]!.scoreHint, -9);
});

test('applyActiveSinsalWeights - 다른 필드 보존', () => {
  __setActiveWeightsForTest({ 천을귀인: 12 });
  const result = applyActiveSinsalWeights(sampleHits);
  assert.equal(result[0]!.name, '천을귀인');
  assert.equal(result[0]!.category, '길신');
  assert.equal(result[0]!.hint, '');
});

test('getActiveWeightsSync - test setter 후 동일 객체 반환', () => {
  const weights = { 천을귀인: 10 };
  __setActiveWeightsForTest(weights);
  const result = getActiveWeightsSync();
  assert.equal(result?.천을귀인, 10);
});

test('getActiveWeightsSync - null setter 후 null', () => {
  __setActiveWeightsForTest(null);
  assert.equal(getActiveWeightsSync(), null);
});

test('applyActiveSinsalWeights - 빈 배열 안전', () => {
  __setActiveWeightsForTest({ 천을귀인: 12 });
  const result = applyActiveSinsalWeights([]);
  assert.deepEqual(result, []);
});
