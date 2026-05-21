// 2026-05-21 — 점수 시스템 메인. phase-1-task.md §7.
//   computeSajuScore(saju) → F1~F5 합산 + 라벨 + 오행 차트. 결정론(동일 입력=동일 출력).
import type { SajuData, SajuScore } from './types';
import {
  calculateF1, calculateF2, calculateF3, calculateF4, calculateF5,
} from './formulas';
import { getLabel } from './labels';
import { computeOhaengChart } from './ohaeng';

const FORMULA_VERSION = '1.0.0';

export function computeSajuScore(
  saju: SajuData,
  options: { now?: Date } = {}
): SajuScore {
  const F1 = calculateF1(saju.ilju);
  const F2 = calculateF2(saju);
  const F3 = calculateF3(saju);
  const F4 = calculateF4(saju);
  const F5 = calculateF5(saju);

  const total = Math.round(F1 + F2 + F3 + F4 + F5);
  const label = getLabel(total);
  const ohaengChart = computeOhaengChart(saju);

  return {
    total,
    breakdown: { F1, F2, F3, F4, F5 },
    label,
    ohaengChart,
    computedAt: (options.now ?? new Date()).toISOString(),
    formulaVersion: FORMULA_VERSION,
  };
}

export {
  calculateF1, calculateF2, calculateF3, calculateF4, calculateF5,
} from './formulas';
export { getLabel } from './labels';
export { computeOhaengChart } from './ohaeng';
export {
  SCORE_LEVEL_TOKENS, OHAENG_TOKENS, BREAKDOWN_FACTOR_META, BREAKDOWN_ORDER,
  getScoreLevelToken, getScoreLevelTokenByTotal, getOhaengToken,
  getBreakdownFactorMeta, getBarFillPercent,
} from './visual-tokens';
export type {
  ScoreLevel, BreakdownKey, ScoreLevelToken, OhaengToken, BreakdownFactorMeta,
} from './visual-tokens';
export {
  OHAENG_RADAR_ORDER, computeOhaengRadarPoints, getDominantOhaeng, getOhaengBalanceLevel,
} from './ohaeng-chart';
export type {
  RadarPoint, OhaengRadarGeometry, RadarOptions, OhaengBalanceLevel,
} from './ohaeng-chart';
export type { SajuData, SajuScore, ScoreLabel, OhaengChartData, Ohaeng } from './types';
