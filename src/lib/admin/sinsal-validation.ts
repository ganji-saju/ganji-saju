// 2026-05-15 — 신살 룰 검증 통계 함수.
// today_fortune_feedback 의 detected_sinsals + overall_rating 으로 각 신살별로
// "발동 vs 미발동" 그룹 비교 → Welch's t-test → p-value 근사.
//
// 외부 라이브러리 없이 Node 만으로 구현. 표본 크기 30+ 이상이면 정규 분포 근사
// 충분히 정확. spec 출처: NIST Handbook §1.3.5.3.

export interface SinsalStats {
  name: string;
  category: '길신' | '흉신' | '양날의검' | 'unknown';
  triggeredCount: number;
  notTriggeredCount: number;
  meanWhenTriggered: number;     // 발동 시 평균 overall_rating (-1~+1)
  meanWhenNotTriggered: number;
  effectSize: number;             // 차이 (mean1 - mean2)
  tStatistic: number;
  significance: 'strong' | 'moderate' | 'weak' | 'none'; // p<0.01 / p<0.05 / p<0.10 / 그 외
  /** spec doc 의 가중치 (사주아이 표 원칙). 데이터 결과와 비교용. */
  expectedScore: number;
  /** 결과 톤 — UI 표시용. */
  verdict: 'confirmed' | 'partial' | 'no-effect' | 'reverse' | 'low-data';
  verdictHint: string;
}

interface FeedbackRow {
  overall_rating: number; // -1 / 0 / 1
  detected_sinsals: Array<{ name: string; category: string }> | null;
}

// spec doc 에서 정의한 예상 효과 (가중치).
// PR #109 의 점수 산출과 동일. 데이터로 검증 후 조정 가능.
const EXPECTED_SCORE_MAP: Record<string, number> = {
  천을귀인: 15, 문창귀인: 10, 천덕귀인: 8, 월덕귀인: 8, 금여록: 6, 암록: 6,
  양인살: -8, 백호살: -12, 괴강살: -5, 공망살: -10, 망신살: -8, 겁살: -8,
  원진살: -7, 귀문관살: -10, 도화살: 3, 역마살: 3, 화개살: 3,
};

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  return arr.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (arr.length - 1);
}

/**
 * Welch's t-test — 표본의 분산이 다를 수 있는 경우 사용.
 * |t| > 2.58 → p<0.01, > 1.96 → p<0.05, > 1.645 → p<0.10.
 */
function welchT(arr1: number[], arr2: number[]) {
  const m1 = mean(arr1);
  const m2 = mean(arr2);
  const v1 = variance(arr1, m1);
  const v2 = variance(arr2, m2);
  const n1 = arr1.length;
  const n2 = arr2.length;
  if (n1 < 2 || n2 < 2 || v1 + v2 === 0) {
    return { t: 0, m1, m2, n1, n2 };
  }
  const t = (m1 - m2) / Math.sqrt(v1 / n1 + v2 / n2);
  return { t, m1, m2, n1, n2 };
}

function significanceOf(t: number): SinsalStats['significance'] {
  const abs = Math.abs(t);
  if (abs > 2.58) return 'strong';
  if (abs > 1.96) return 'moderate';
  if (abs > 1.645) return 'weak';
  return 'none';
}

function inferCategory(name: string): SinsalStats['category'] {
  if (['천을귀인', '문창귀인', '천덕귀인', '월덕귀인', '금여록', '암록'].includes(name)) return '길신';
  if (['양인살', '백호살', '공망살', '원진살', '귀문관살', '망신살', '겁살'].includes(name)) return '흉신';
  if (['괴강살', '도화살', '역마살', '화개살'].includes(name) || name.startsWith('삼재'))
    return '양날의검';
  return 'unknown';
}

/**
 * 데이터 기반 결론.
 * - 표본 < 30: 'low-data' (검증 불충분)
 * - 길신 + effectSize > 0 + 유의: 'confirmed' (예상대로 좋음)
 * - 흉신 + effectSize < 0 + 유의: 'confirmed' (예상대로 나쁨)
 * - 부분 일치: 'partial' (유의하지만 약함)
 * - 효과 없음: 'no-effect'
 * - 예상과 반대: 'reverse'
 */
function inferVerdict(
  category: SinsalStats['category'],
  expected: number,
  effectSize: number,
  significance: SinsalStats['significance'],
  totalSample: number
): { verdict: SinsalStats['verdict']; hint: string } {
  if (totalSample < 30) {
    return { verdict: 'low-data', hint: '표본 부족 — 30건 이상 누적 필요' };
  }
  if (significance === 'none') {
    return { verdict: 'no-effect', hint: '통계적 유의차 없음 — 가중치 재고 가능' };
  }
  const sameDirection =
    (expected > 0 && effectSize > 0) || (expected < 0 && effectSize < 0);
  if (sameDirection) {
    if (significance === 'strong') {
      return { verdict: 'confirmed', hint: '예상 효과 강하게 검증됨' };
    }
    return { verdict: 'partial', hint: '예상 효과 약하게 검증됨' };
  }
  return { verdict: 'reverse', hint: '예상과 반대 — 가중치 부호 검토 필요' };
}

/**
 * 메인 분석 — 전체 피드백 row 에서 각 신살별 통계 산출.
 * @param rows today_fortune_feedback 의 (overall_rating, detected_sinsals) 페이지.
 */
export function analyzeSinsalEffects(rows: FeedbackRow[]): SinsalStats[] {
  if (rows.length === 0) return [];

  // 신살 이름 set 수집.
  const allNames = new Set<string>();
  for (const row of rows) {
    if (!row.detected_sinsals) continue;
    for (const sinsal of row.detected_sinsals) {
      if (sinsal && typeof sinsal.name === 'string') allNames.add(sinsal.name);
    }
  }

  const results: SinsalStats[] = [];

  for (const name of allNames) {
    const triggered: number[] = [];
    const notTriggered: number[] = [];
    for (const row of rows) {
      const has = row.detected_sinsals?.some((s) => s?.name === name) ?? false;
      const r = row.overall_rating;
      if (typeof r !== 'number') continue;
      if (has) triggered.push(r);
      else notTriggered.push(r);
    }

    if (triggered.length === 0) continue; // 한 번도 발동 안 한 신살은 분석 제외.

    const test = welchT(triggered, notTriggered);
    const effectSize = test.m1 - test.m2;
    const significance = significanceOf(test.t);
    const category = inferCategory(name);
    const expected = EXPECTED_SCORE_MAP[name] ?? 0;
    const { verdict, hint } = inferVerdict(
      category,
      expected,
      effectSize,
      significance,
      triggered.length + notTriggered.length
    );

    results.push({
      name,
      category,
      triggeredCount: triggered.length,
      notTriggeredCount: notTriggered.length,
      meanWhenTriggered: Number(test.m1.toFixed(3)),
      meanWhenNotTriggered: Number(test.m2.toFixed(3)),
      effectSize: Number(effectSize.toFixed(3)),
      tStatistic: Number(test.t.toFixed(2)),
      significance,
      expectedScore: expected,
      verdict,
      verdictHint: hint,
    });
  }

  // 정렬: |effect size| 절댓값 내림차순. (강한 영향 신살이 먼저).
  results.sort((a, b) => Math.abs(b.effectSize) - Math.abs(a.effectSize));
  return results;
}

export interface DatasetSummary {
  totalFeedback: number;
  feedbackWithSinsals: number;
  uniqueSinsals: number;
  oldestDate: string | null;
  newestDate: string | null;
}

export function summarizeDataset(
  rows: Array<{ created_at: string; detected_sinsals: unknown }>
): DatasetSummary {
  const withSinsals = rows.filter((r) => {
    const arr = r.detected_sinsals as Array<unknown> | null;
    return Array.isArray(arr) && arr.length > 0;
  });
  const allNames = new Set<string>();
  for (const r of withSinsals) {
    const arr = r.detected_sinsals as Array<{ name?: string }>;
    for (const s of arr) if (s?.name) allNames.add(s.name);
  }
  const sorted = rows.map((r) => r.created_at).sort();
  return {
    totalFeedback: rows.length,
    feedbackWithSinsals: withSinsals.length,
    uniqueSinsals: allNames.size,
    oldestDate: sorted[0] ?? null,
    newestDate: sorted[sorted.length - 1] ?? null,
  };
}
