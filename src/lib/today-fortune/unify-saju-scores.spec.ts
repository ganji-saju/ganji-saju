/**
 * 점수 통일 helper 단위 테스트.
 *
 * 핵심 보장 (PROGRESS.md §2.2):
 *   1) overall 점수 === iljinScore.totalScore (single source of truth)
 *   2) 영역별 점수 평균 ≈ totalScore (상대 차이 보존)
 *   3) clampUnified(5~95) 범위 강제
 *   4) iljinScore null 이면 raw scores 그대로 (시 미입력 사주 fallback)
 *
 * 회귀 방지:
 *   - PR #176 의 clampScore(48~92) 가 iljinScore.totalScore(5~95)를 끌어올리던 회귀 차단
 *   - PR #179 사주 페이지 ↔ 운세 페이지 점수 일치 보장
 */
import { describe, expect, it } from 'vitest';
import { unifyScoresWithIljinScore } from './unify-saju-scores';

describe('unifyScoresWithIljinScore', () => {
  const baseScores = [
    { key: 'overall', label: '총운', score: 70, summary: '' },
    { key: 'love', label: '연애', score: 80, summary: '' },
    { key: 'wealth', label: '재물', score: 60, summary: '' },
    { key: 'career', label: '직업', score: 75, summary: '' },
  ];

  it('overall 점수를 iljinTotalScore 로 정확히 덮어쓴다', () => {
    const result = unifyScoresWithIljinScore(baseScores, 45);
    const overall = result.find((s) => s.key === 'overall');
    expect(overall?.score).toBe(45);
  });

  it('영역별 점수 평균이 iljinTotalScore 가 된다 (정규화)', () => {
    const result = unifyScoresWithIljinScore(baseScores, 45);
    const nonOverall = result.filter((s) => s.key !== 'overall');
    const mean = nonOverall.reduce((sum, s) => sum + s.score, 0) / nonOverall.length;
    // 영역별 평균은 클램프로 ±2 정도 오차 허용 (round + clamp 영향)
    expect(mean).toBeGreaterThanOrEqual(43);
    expect(mean).toBeLessThanOrEqual(47);
  });

  it('영역별 상대 차이 (정렬 순서) 를 보존한다', () => {
    const rawSorted = baseScores
      .filter((s) => s.key !== 'overall')
      .sort((a, b) => b.score - a.score)
      .map((s) => s.key);
    const result = unifyScoresWithIljinScore(baseScores, 45);
    const unifiedSorted = result
      .filter((s) => s.key !== 'overall')
      .sort((a, b) => b.score - a.score)
      .map((s) => s.key);
    expect(unifiedSorted).toEqual(rawSorted);
  });

  it('iljinTotalScore 가 5 미만이어도 결과는 5 이상 (clampUnified 하한)', () => {
    const result = unifyScoresWithIljinScore(baseScores, 3);
    for (const score of result) {
      expect(score.score).toBeGreaterThanOrEqual(5);
    }
  });

  it('iljinTotalScore 가 95 초과여도 결과는 95 이하 (clampUnified 상한)', () => {
    const result = unifyScoresWithIljinScore(baseScores, 99);
    for (const score of result) {
      expect(score.score).toBeLessThanOrEqual(95);
    }
  });

  it('clampScore(48~92) floor 가 적용되지 않는다 — iljinScore 의 자연 범위 5~95 보존', () => {
    // 회귀 방지: PR #176 issue 1 — clampScore 가 iljinScore.totalScore=10 을 48 로 끌어올렸음.
    const result = unifyScoresWithIljinScore(baseScores, 10);
    const overall = result.find((s) => s.key === 'overall');
    expect(overall?.score).toBe(10);
  });

  it('overall 외 다른 필드 (key, label, summary) 는 보존한다', () => {
    const result = unifyScoresWithIljinScore(baseScores, 45);
    const love = result.find((s) => s.key === 'love');
    expect(love?.key).toBe('love');
    expect(love?.label).toBe('연애');
  });

  it('overall 만 있고 영역별이 없으면 raw 그대로 반환 (mean 0으로 나누기 방지)', () => {
    const onlyOverall = [{ key: 'overall', label: '총운', score: 70, summary: '' }];
    const result = unifyScoresWithIljinScore(onlyOverall, 45);
    expect(result).toEqual(onlyOverall);
  });

  it('빈 배열은 그대로 반환', () => {
    expect(unifyScoresWithIljinScore([], 45)).toEqual([]);
  });

  it('정수가 아닌 iljinTotalScore 도 round 처리', () => {
    const result = unifyScoresWithIljinScore(baseScores, 44.6);
    const overall = result.find((s) => s.key === 'overall');
    expect(overall?.score).toBe(45);
  });
});
