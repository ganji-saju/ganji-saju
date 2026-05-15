// 2026-05-15 — 신살 가중치 ML 학습 검증.
import assert from 'node:assert/strict';
import { CURRENT_WEIGHTS, diffWeights, learnSinsalWeights } from './weight-learning';

declare const test: (name: string, fn: () => void) => void;

test('learnSinsalWeights - 빈 데이터셋 → null', () => {
  const result = learnSinsalWeights([]);
  assert.equal(result, null);
});

test('learnSinsalWeights - 표본 부족 시 null', () => {
  // 신살 발동은 있지만 row 가 적어서 dim+2 미만.
  const rows = [
    { overall_rating: 1, detected_sinsals: [{ name: '천을귀인' }] },
    { overall_rating: 0, detected_sinsals: null },
  ];
  const result = learnSinsalWeights(rows);
  assert.equal(result, null);
});

test('learnSinsalWeights - 천을귀인 발동 시 +rating → 양의 가중치', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string }> | null;
  }> = [];
  // 천을귀인 발동 100건 → +1 평균.
  for (let i = 0; i < 100; i += 1) {
    rows.push({
      overall_rating: i % 8 === 0 ? 0 : 1, // 평균 +0.875
      detected_sinsals: [{ name: '천을귀인' }],
    });
  }
  // 미발동 200건 → 0 평균.
  for (let i = 0; i < 200; i += 1) {
    rows.push({
      overall_rating: i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : -1,
      detected_sinsals: null,
    });
  }
  const result = learnSinsalWeights(rows);
  assert.ok(result);
  assert.ok(result!.weights.천을귀인! > 5, `천을귀인 weight > 5 (got ${result!.weights.천을귀인})`);
  assert.equal(result!.features.length, 1);
  assert.equal(result!.sampleSize, 300);
});

test('learnSinsalWeights - 백호살 발동 시 -rating → 음의 가중치', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string }> | null;
  }> = [];
  for (let i = 0; i < 80; i += 1) {
    rows.push({
      overall_rating: i % 6 === 0 ? 0 : -1, // 평균 -0.83
      detected_sinsals: [{ name: '백호살' }],
    });
  }
  for (let i = 0; i < 200; i += 1) {
    rows.push({
      overall_rating: i % 3 === 0 ? 1 : 0,
      detected_sinsals: null,
    });
  }
  const result = learnSinsalWeights(rows);
  assert.ok(result);
  assert.ok(result!.weights.백호살! < -5, `백호살 weight < -5 (got ${result!.weights.백호살})`);
});

test('learnSinsalWeights - 발동 5건 미만 신살은 feature 에서 제외', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string }> | null;
  }> = [];
  // 천을귀인은 충분히 (50건).
  for (let i = 0; i < 50; i += 1) {
    rows.push({ overall_rating: 1, detected_sinsals: [{ name: '천을귀인' }] });
  }
  // 희귀신살은 단 2건만.
  rows.push({ overall_rating: 1, detected_sinsals: [{ name: '희귀신살' }] });
  rows.push({ overall_rating: 0, detected_sinsals: [{ name: '희귀신살' }] });
  for (let i = 0; i < 100; i += 1) {
    rows.push({ overall_rating: 0, detected_sinsals: null });
  }
  const result = learnSinsalWeights(rows);
  assert.ok(result);
  assert.ok(result!.features.includes('천을귀인'));
  assert.ok(!result!.features.includes('희귀신살'), '5건 미만 제외');
});

test('learnSinsalWeights - 다중 신살 동시 발동 처리', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string }> | null;
  }> = [];
  // 천을 + 문창 → 둘 다 양수 효과로 +1.
  for (let i = 0; i < 50; i += 1) {
    rows.push({
      overall_rating: 1,
      detected_sinsals: [{ name: '천을귀인' }, { name: '문창귀인' }],
    });
  }
  // 천을만 → +0.5.
  for (let i = 0; i < 50; i += 1) {
    rows.push({
      overall_rating: i % 2 === 0 ? 1 : 0,
      detected_sinsals: [{ name: '천을귀인' }],
    });
  }
  // 미발동.
  for (let i = 0; i < 150; i += 1) {
    rows.push({ overall_rating: 0, detected_sinsals: null });
  }
  const result = learnSinsalWeights(rows);
  assert.ok(result);
  assert.ok(result!.features.includes('천을귀인'));
  assert.ok(result!.features.includes('문창귀인'));
  // 둘 다 양의 weight 여야.
  assert.ok(result!.weights.천을귀인! > 0);
  assert.ok(result!.weights.문창귀인! >= 0); // ridge 라 다소 줄어들 수 있음.
});

test('learnSinsalWeights - MSE/R² 계산 결과 합리적', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string }> | null;
  }> = [];
  for (let i = 0; i < 100; i += 1) {
    rows.push({
      overall_rating: 1,
      detected_sinsals: [{ name: '천을귀인' }],
    });
  }
  for (let i = 0; i < 100; i += 1) {
    rows.push({ overall_rating: -1, detected_sinsals: [{ name: '백호살' }] });
  }
  const result = learnSinsalWeights(rows);
  assert.ok(result);
  // 완벽 분리 가능 → MSE 낮고 R² 높아야.
  assert.ok(result!.mse < 0.1, `mse 낮아야 (got ${result!.mse})`);
  assert.ok(result!.rSquared === null || result!.rSquared > 0.9, `R² 높아야 (got ${result!.rSquared})`);
});

test('diffWeights - 부호 반대 → flip-sign 추천', () => {
  // 현재 천을귀인 = +15, 학습 결과는 음수로 가정 (가짜).
  const fakeResult = {
    weights: { 천을귀인: -5 },
    rawCoefficients: { 천을귀인: -0.33 },
    intercept: 0,
    sampleSize: 200,
    perSinsalStats: { 천을귀인: { triggered: 50, mean: -0.5 } },
    mse: 0.5,
    rSquared: 0.2,
    lambda: 1,
    features: ['천을귀인'],
  };
  const diffs = diffWeights(fakeResult);
  const tianyi = diffs.find((d) => d.name === '천을귀인');
  assert.ok(tianyi);
  assert.equal(tianyi!.recommendation, 'flip-sign');
});

test('diffWeights - 변화 크면 major-revise', () => {
  const fakeResult = {
    weights: { 백호살: -2 }, // 현재 -12 → 학습 -2 = +10 변화.
    rawCoefficients: { 백호살: -0.13 },
    intercept: 0,
    sampleSize: 200,
    perSinsalStats: { 백호살: { triggered: 30, mean: -0.2 } },
    mse: 0.5,
    rSquared: 0.1,
    lambda: 1,
    features: ['백호살'],
  };
  const diffs = diffWeights(fakeResult);
  const baekho = diffs.find((d) => d.name === '백호살');
  assert.ok(baekho);
  assert.equal(baekho!.recommendation, 'major-revise');
});

test('diffWeights - 변화 미미하면 keep', () => {
  const fakeResult = {
    weights: { 천을귀인: 14 }, // 현재 15 → 학습 14 = -1.
    rawCoefficients: { 천을귀인: 0.93 },
    intercept: 0,
    sampleSize: 200,
    perSinsalStats: { 천을귀인: { triggered: 50, mean: 0.9 } },
    mse: 0.3,
    rSquared: 0.4,
    lambda: 1,
    features: ['천을귀인'],
  };
  const diffs = diffWeights(fakeResult);
  const tianyi = diffs.find((d) => d.name === '천을귀인');
  assert.ok(tianyi);
  assert.equal(tianyi!.recommendation, 'keep');
});

test('CURRENT_WEIGHTS - 모든 키가 유효한 신살 이름', () => {
  const known = [
    '천을귀인',
    '문창귀인',
    '천덕귀인',
    '월덕귀인',
    '금여록',
    '암록',
    '양인살',
    '백호살',
    '괴강살',
    '공망살',
    '망신살',
    '겁살',
    '원진살',
    '귀문관살',
    '도화살',
    '역마살',
    '화개살',
  ];
  for (const name of Object.keys(CURRENT_WEIGHTS)) {
    assert.ok(known.includes(name), `${name} not in known sinsal list`);
  }
});
