// 2026-05-15 — 신살 검증 통계 함수 검증.
import assert from 'node:assert/strict';
import { analyzeSinsalEffects, summarizeDataset } from './sinsal-validation';

declare const test: (name: string, fn: () => void) => void;

test('analyzeSinsalEffects - 빈 데이터셋', () => {
  const result = analyzeSinsalEffects([]);
  assert.deepEqual(result, []);
});

test('analyzeSinsalEffects - 천을귀인 발동 시 평균 ↑, 미발동 ≈ 중립', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string; category: string }> | null;
  }> = [];
  // 천을귀인 발동 50건: 평균 +0.6
  for (let i = 0; i < 50; i += 1) {
    rows.push({
      overall_rating: i % 5 === 0 ? 0 : 1,
      detected_sinsals: [{ name: '천을귀인', category: '길신' }],
    });
  }
  // 미발동 200건: 평균 0
  for (let i = 0; i < 200; i += 1) {
    rows.push({
      overall_rating: i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : -1,
      detected_sinsals: null,
    });
  }
  const result = analyzeSinsalEffects(rows);
  const tianyi = result.find((s) => s.name === '천을귀인');
  assert.ok(tianyi, '천을귀인 결과 있어야 함');
  assert.equal(tianyi!.triggeredCount, 50);
  assert.equal(tianyi!.notTriggeredCount, 200);
  assert.ok(tianyi!.effectSize > 0, `발동 시 평균 ↑ (effect=${tianyi!.effectSize})`);
  assert.equal(tianyi!.category, '길신');
});

test('analyzeSinsalEffects - 백호살 발동 시 평균 ↓', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string; category: string }> | null;
  }> = [];
  // 분산이 있어야 Welch's t-test 가 의미 있음 (실제 데이터처럼).
  for (let i = 0; i < 40; i += 1) {
    rows.push({
      overall_rating: i % 5 === 0 ? 0 : -1, // 평균 -0.8
      detected_sinsals: [{ name: '백호살', category: '흉신' }],
    });
  }
  for (let i = 0; i < 160; i += 1) {
    rows.push({
      overall_rating: i % 3 === 0 ? 1 : i % 3 === 1 ? 0 : 0, // 평균 ~+0.33
      detected_sinsals: null,
    });
  }
  const result = analyzeSinsalEffects(rows);
  const baekho = result.find((s) => s.name === '백호살');
  assert.ok(baekho);
  assert.ok(baekho!.effectSize < 0, `백호살 발동 시 ↓ (effect=${baekho!.effectSize})`);
  assert.equal(baekho!.category, '흉신');
  // 강한 유의차로 confirmed 또는 partial 둘 다 허용.
  assert.ok(
    baekho!.verdict === 'confirmed' || baekho!.verdict === 'partial',
    `verdict=${baekho!.verdict}`
  );
});

test('analyzeSinsalEffects - 표본 부족 시 low-data verdict', () => {
  const rows = [
    { overall_rating: 1, detected_sinsals: [{ name: '천을귀인', category: '길신' }] },
    { overall_rating: 1, detected_sinsals: [{ name: '천을귀인', category: '길신' }] },
    { overall_rating: 0, detected_sinsals: null },
  ];
  const result = analyzeSinsalEffects(rows);
  const tianyi = result.find((s) => s.name === '천을귀인');
  assert.ok(tianyi);
  assert.equal(tianyi!.verdict, 'low-data');
});

test('analyzeSinsalEffects - 효과 크기 절댓값 기준 정렬', () => {
  const rows: Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string; category: string }> | null;
  }> = [];
  // A 신살: 큰 효과
  for (let i = 0; i < 100; i += 1) {
    rows.push({
      overall_rating: 1,
      detected_sinsals: [{ name: '천을귀인', category: '길신' }],
    });
  }
  // B 신살: 작은 효과
  for (let i = 0; i < 100; i += 1) {
    rows.push({
      overall_rating: i % 10 === 0 ? 1 : 0,
      detected_sinsals: [{ name: '도화살', category: '양날의검' }],
    });
  }
  // 미발동
  for (let i = 0; i < 200; i += 1) {
    rows.push({ overall_rating: 0, detected_sinsals: null });
  }
  const result = analyzeSinsalEffects(rows);
  assert.ok(result.length >= 2);
  assert.ok(Math.abs(result[0]!.effectSize) >= Math.abs(result[1]!.effectSize), '정렬 순서');
});

test('summarizeDataset - 신살 종 count', () => {
  const result = summarizeDataset([
    { created_at: '2026-05-01T00:00:00Z', detected_sinsals: [{ name: '천을귀인' }] },
    { created_at: '2026-05-02T00:00:00Z', detected_sinsals: [{ name: '백호살' }] },
    { created_at: '2026-05-03T00:00:00Z', detected_sinsals: [{ name: '천을귀인' }, { name: '도화살' }] },
    { created_at: '2026-05-04T00:00:00Z', detected_sinsals: null },
  ]);
  assert.equal(result.totalFeedback, 4);
  assert.equal(result.feedbackWithSinsals, 3);
  assert.equal(result.uniqueSinsals, 3); // 천을귀인, 백호살, 도화살
  assert.equal(result.oldestDate, '2026-05-01T00:00:00Z');
  assert.equal(result.newestDate, '2026-05-04T00:00:00Z');
});
