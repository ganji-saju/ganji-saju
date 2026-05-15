// 2026-05-15 — 별자리 두 개 궁합 분석 검증.
import assert from 'node:assert/strict';
import { analyzeCompatibility } from './compatibility';

declare const test: (name: string, fn: () => void) => void;

test('analyzeCompatibility - 동일 별자리 → 자기 자신', () => {
  const r = analyzeCompatibility('leo', 'leo');
  assert.equal(r.a, 'leo');
  assert.equal(r.b, 'leo');
  assert.equal(r.overallScore, 90);
  assert.equal(r.tone, 'best');
});

test('analyzeCompatibility - trine (양-사자) → best/good 점수', () => {
  const r = analyzeCompatibility('aries', 'leo');
  assert.ok(r.overallScore >= 85, `score >= 85 (got ${r.overallScore})`);
  assert.ok(['best', 'good'].includes(r.tone));
});

test('analyzeCompatibility - square (양-게) → 낮은 점수', () => {
  const r = analyzeCompatibility('aries', 'cancer');
  assert.ok(r.overallScore < 75, `square score < 75 (got ${r.overallScore})`);
});

test('analyzeCompatibility - 6 areas 모두 50-95 범위', () => {
  const r = analyzeCompatibility('aries', 'libra');
  assert.equal(r.areas.length, 6);
  const expectedAreas = ['연애', '우정', '직장', '결혼', '소통', '여행'];
  for (let i = 0; i < r.areas.length; i += 1) {
    const a = r.areas[i]!;
    assert.equal(a.area, expectedAreas[i]);
    assert.ok(a.score >= 50 && a.score <= 95, `${a.area} score ${a.score} out of range`);
    assert.ok(a.hint.length > 0);
  }
});

test('analyzeCompatibility - strengths/tensions 비어있지 않음', () => {
  const r = analyzeCompatibility('cancer', 'scorpio');
  assert.ok(r.strengths.length >= 1);
  assert.ok(r.tensions.length >= 1);
  assert.ok(r.strengths.length <= 4);
  assert.ok(r.tensions.length <= 3);
});

test('analyzeCompatibility - dateIdeas 3개', () => {
  const r = analyzeCompatibility('aries', 'leo');
  assert.equal(r.dateIdeas.length, 3);
});

test('analyzeCompatibility - conflictTips 1-3개', () => {
  const r = analyzeCompatibility('taurus', 'aquarius');
  assert.ok(r.conflictTips.length >= 1 && r.conflictTips.length <= 3);
});

test('analyzeCompatibility - element 관계 라벨', () => {
  const fireFire = analyzeCompatibility('aries', 'leo');
  assert.ok(fireFire.elementRelation.includes('불'));

  const fireAir = analyzeCompatibility('aries', 'libra');
  assert.ok(fireAir.elementRelation.includes('조화'));

  const fireWater = analyzeCompatibility('aries', 'cancer');
  assert.ok(fireWater.elementRelation.includes('대조') || fireWater.elementRelation.includes('중성'));
});

test('analyzeCompatibility - headline 점수에 따라 달라짐', () => {
  const high = analyzeCompatibility('aries', 'leo');
  const low = analyzeCompatibility('virgo', 'sagittarius');
  assert.notEqual(high.headline, low.headline);
});

test('analyzeCompatibility - 대칭 (a,b)=(b,a) 점수 동일', () => {
  const r1 = analyzeCompatibility('cancer', 'capricorn');
  const r2 = analyzeCompatibility('capricorn', 'cancer');
  assert.equal(r1.overallScore, r2.overallScore);
});

test('analyzeCompatibility - 모든 12×12 조합 동작', () => {
  const signs = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ] as const;
  for (const a of signs) {
    for (const b of signs) {
      const r = analyzeCompatibility(a, b);
      assert.ok(r.overallScore >= 50 && r.overallScore <= 95);
      assert.ok(r.headline.length > 0);
    }
  }
});
