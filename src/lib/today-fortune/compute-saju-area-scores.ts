// 2026-05-16 PR #181 — 사주 페이지 ↔ 오늘 운세 페이지의 6 영역 카드 score 정확 일치 helper.
//
// 사용자 보고 (PR #180 후속):
//   사주 메인 (4 카드: 총운/연애/재물/직장) ≠ 사주 상세 (5 카드) ≠ 운세 페이지 (5 카드).
//   "총운 직장운 재물운 연애운 관계운 컨디션" 6 항목 모두 동일하게 표시 요구.
//
// 이 helper 는 buildTodayFortune 의 toTodayScores 와 동일한 산식으로 6 영역 통일 score 를
// 만들어 모든 사주 페이지가 운세 페이지와 동일한 6 영역 값을 받게 한다.

import type { BirthInput } from '@/lib/saju/types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuReport } from '@/domain/saju/report';
import {
  buildConditionScore,
  buildDailyDelta,
  computeSajuIljinScore,
  getTodayPillarSnapshot,
} from '@/server/today-fortune/build-today-fortune';
import { unifyScoresWithIljinScore } from './unify-saju-scores';

export type SajuAreaKey =
  | 'overall'
  | 'career'
  | 'wealth'
  | 'love'
  | 'relationship'
  | 'condition';

export interface SajuAreaScore {
  key: SajuAreaKey;
  score: number;
}

// 6 영역 통일 라벨 (운세 페이지 기준 긴 라벨 — 사용자 선택).
export const UNIFIED_AREA_LABELS: Record<SajuAreaKey, string> = {
  overall: '총운',
  career: '직장·사업운',
  wealth: '재물운',
  love: '애정·연애운',
  relationship: '인간관계운',
  condition: '컨디션·건강운',
};

// 6 영역 통일 색상 (CSS var).
export const UNIFIED_AREA_COLORS: Record<SajuAreaKey, string> = {
  overall: 'var(--app-pink-strong)',
  career: 'var(--app-jade)',
  wealth: 'var(--app-amber)',
  love: 'var(--app-coral)',
  relationship: '#5C82C8',
  condition: '#8E5BC9',
};

// 카드 노출 순서 (사용자 명시: 총운 → 직장 → 재물 → 연애 → 관계 → 컨디션).
export const UNIFIED_AREA_ORDER: SajuAreaKey[] = [
  'overall',
  'career',
  'wealth',
  'love',
  'relationship',
  'condition',
];

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/**
 * 사주 페이지에서 호출 — 5 영역 buildSajuReport + condition (buildTodayFortune 산식)
 * + unifyScoresWithIljinScore 적용해 6 영역 통일 score 반환.
 *
 * 이 결과의 각 score 는 운세 페이지의 동일 영역 score 와 1:1 일치.
 * iljinScore 계산 불가 (시 미입력 등) 시 raw scores 반환 (safe fallback).
 */
export function computeSajuAreaScores(
  input: BirthInput,
  sajuData: SajuDataV1
): SajuAreaScore[] {
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const loveReport = buildSajuReport(input, sajuData, 'love');
  const wealthReport = buildSajuReport(input, sajuData, 'wealth');
  const careerReport = buildSajuReport(input, sajuData, 'career');
  const relationshipReport = buildSajuReport(input, sajuData, 'relationship');

  const todayPillar = getTodayPillarSnapshot(sajuData);
  const dailyDelta = buildDailyDelta(todayPillar, sajuData);
  const conditionRaw = clampScore(
    buildConditionScore(todayReport, loveReport, wealthReport, sajuData) + dailyDelta
  );

  const rawScores: SajuAreaScore[] = [
    { key: 'overall', score: todayReport.scores.find((s) => s.key === 'overall')?.score ?? 0 },
    { key: 'career', score: careerReport.scores.find((s) => s.key === 'career')?.score ?? 0 },
    { key: 'wealth', score: wealthReport.scores.find((s) => s.key === 'wealth')?.score ?? 0 },
    { key: 'love', score: loveReport.scores.find((s) => s.key === 'love')?.score ?? 0 },
    { key: 'relationship', score: relationshipReport.scores.find((s) => s.key === 'relationship')?.score ?? 0 },
    { key: 'condition', score: conditionRaw },
  ];

  const iljinResult = computeSajuIljinScore(sajuData);
  if (!iljinResult) return rawScores;

  return unifyScoresWithIljinScore(rawScores, iljinResult.totalScore);
}
