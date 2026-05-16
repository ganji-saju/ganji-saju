// 2026-05-16 PR #179 — 사주 페이지 ↔ 운세 페이지 점수 단일화 helper.
//
// 사용자 보고 (PROGRESS.md §3 신규):
//   사주 페이지의 "오늘의 분야별 흐름" 총운 69 vs 오늘 운세 페이지 45 → 24점 차이.
//   원인: 사주 페이지가 buildSajuReport() 의 자체 clampScore(48~92) 산식만 쓰고,
//         iljinScore.totalScore single-source-of-truth (PR #165) 통일 절차를 안 거침.
//
// 이 helper 는 build-today-fortune.ts:2615-2628 의 inline 통일 로직과 1:1 동일.
// 동일 함수를 사주 페이지(서버 컴포넌트)에서도 호출해 score 가 두 페이지에서 일치하게 만든다.
//
// 규칙:
//   - overall = clampUnified(iljinTotalScore)  (헤드라인/banner 모두 같은 숫자)
//   - 영역별 = clampUnified(iljinTotalScore + (영역점수 - 영역평균))
//              → 평균이 totalScore 가 되고 상대 차이 보존
//   - clampUnified 범위는 5~95 (iljinScore.totalScore 자연 범위와 매칭).
//   - PR #176 회귀 차단: clampScore(48~92) floor 는 적용하지 않음.

const clampUnified = (value: number) => Math.max(5, Math.min(95, Math.round(value)));

export function unifyScoresWithIljinScore<T extends { key: string; score: number }>(
  rawScores: T[],
  iljinTotalScore: number
): T[] {
  const nonOverall = rawScores.filter((s) => s.key !== 'overall');
  if (nonOverall.length === 0) return rawScores;

  const mean = nonOverall.reduce((sum, s) => sum + s.score, 0) / nonOverall.length;
  return rawScores.map((s) => {
    if (s.key === 'overall') {
      return { ...s, score: clampUnified(iljinTotalScore) };
    }
    const delta = s.score - mean;
    return { ...s, score: clampUnified(iljinTotalScore + delta) };
  });
}
