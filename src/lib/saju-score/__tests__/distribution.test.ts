import assert from 'node:assert/strict';
import { validateDistribution } from '../distribution';
import { ALL_TEST_CASES } from '../test-cases';
import { computeSajuScore } from '../index';

// 2026-05-21 — 50 케이스 분포 검증. phase-1-task.md §11.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('점수 분포: 평균 65~70 / 표준편차 8~15 / 양극단 ≤15%', () => {
  const result = validateDistribution();
  const s = result.stats;
  console.log('\n[saju-score] 분포 통계');
  console.log(`  평균 ${s.mean.toFixed(1)} · 표준편차 ${s.stdDev.toFixed(1)} · 최소 ${s.min} · 최대 ${s.max}`);
  console.log(
    `  분포 excellent ${s.percentages.excellent.toFixed(0)}% / good ${s.percentages.good.toFixed(0)}% / ` +
      `neutral ${s.percentages.neutral.toFixed(0)}% / mindful ${s.percentages.mindful.toFixed(0)}% / ` +
      `potential ${s.percentages.potential.toFixed(0)}%`
  );
  if (!result.ok) {
    console.log('  분포 미충족 사유:', result.reasons.join(' | '));
    // 케이스별 점수 덤프 (튜닝용)
    const scored = ALL_TEST_CASES.map((tc) => `${tc.id}:${computeSajuScore(tc.saju).total}`);
    console.log('  케이스별:', scored.join(' '));
  }
  assert.ok(result.ok, result.reasons.join(' | '));
});

test('50 케이스 모두 유효 SajuData (8글자 일관성)', () => {
  for (const tc of ALL_TEST_CASES) {
    const { saju } = tc;
    assert.equal(saju.allEightChars.length, 8, `${tc.id} 8글자`);
    assert.equal(saju.ilgan, saju.ilju.gan, `${tc.id} ilgan=ilju.gan`);
    assert.equal(saju.cheongan.length, 4);
    assert.equal(saju.jiji.length, 4);
  }
});

test('테스트 케이스 정확히 50개', () => {
  assert.equal(ALL_TEST_CASES.length, 50);
});
