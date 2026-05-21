// 2026-05-21 — 50 케이스 점수 분포 검증. phase-1-task.md §9.
import type { ValidationResult } from './types';
import { ALL_TEST_CASES } from './test-cases';
import { computeSajuScore } from './index';

export interface DistributionStats {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  histogram: {
    excellent: number;
    good: number;
    neutral: number;
    mindful: number;
    potential: number;
  };
  percentages: {
    excellent: number;
    good: number;
    neutral: number;
    mindful: number;
    potential: number;
  };
}

export function computeDistribution(scores: number[]): DistributionStats {
  const count = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / count;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  const histogram = {
    excellent: scores.filter((s) => s >= 90).length,
    good: scores.filter((s) => s >= 75 && s < 90).length,
    neutral: scores.filter((s) => s >= 60 && s < 75).length,
    mindful: scores.filter((s) => s >= 45 && s < 60).length,
    potential: scores.filter((s) => s < 45).length,
  };

  return {
    count,
    mean,
    stdDev,
    min: Math.min(...scores),
    max: Math.max(...scores),
    histogram,
    percentages: {
      excellent: (histogram.excellent / count) * 100,
      good: (histogram.good / count) * 100,
      neutral: (histogram.neutral / count) * 100,
      mindful: (histogram.mindful / count) * 100,
      potential: (histogram.potential / count) * 100,
    },
  };
}

export function validateDistribution(): ValidationResult & { stats: DistributionStats } {
  const scores = ALL_TEST_CASES.map((tc) => computeSajuScore(tc.saju).total);
  const stats = computeDistribution(scores);
  const reasons: string[] = [];

  if (stats.mean < 60 || stats.mean > 75) {
    reasons.push(`평균 ${stats.mean.toFixed(1)} (목표 65~70)`);
  }
  if (stats.stdDev < 8 || stats.stdDev > 15) {
    reasons.push(`표준편차 ${stats.stdDev.toFixed(1)} (목표 ~12)`);
  }
  if (stats.percentages.potential > 15) {
    reasons.push(`44점 이하 비율 너무 높음: ${stats.percentages.potential.toFixed(1)}% (목표 5~10%)`);
  }
  if (stats.percentages.excellent > 15) {
    reasons.push(`90점 이상 비율 너무 높음: ${stats.percentages.excellent.toFixed(1)}% (목표 5~10%)`);
  }

  ALL_TEST_CASES.forEach((tc, i) => {
    if (tc.expectedRange) {
      const actual = scores[i];
      const [min, max] = tc.expectedRange;
      if (actual < min || actual > max) {
        reasons.push(`${tc.id} 예상 범위 ${min}-${max} 벗어남: 실제 ${actual}점`);
      }
    }
  });

  return { ok: reasons.length === 0, reasons, stats };
}
