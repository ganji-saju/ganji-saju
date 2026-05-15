// 2026-05-15 — 신살 가중치 ML 학습.
// today_fortune_feedback 의 (overall_rating, detected_sinsals) 에서
// 릿지 회귀 (L2 regularization) 로 신살별 최적 가중치 산출.
//
// 모델: y = intercept + Σ_j w_j × x_j  여기서
//  - y = overall_rating ∈ {-1, 0, +1}
//  - x_j = 1 (신살 j 가 발동된 경우), 0 (그 외)
//
// 정규방정식: w = (X^T X + λI)^-1 X^T y
// 다중공선성 (백호살 + 양인살 동시 발동 등) 대응을 위해 L2 정규화.
// 외부 라이브러리 없이 가우스 소거법으로 직접 구현 (특징 수 ~17 → 17×17 행렬).
//
// 마지막 단계에서 학습된 회귀계수 (-1 ~ +1 스케일) 를 운영용 점수 스케일 (-15~+15) 로
// 변환. 비교용 expected score 와 같은 단위.

interface FeedbackRow {
  overall_rating: number;
  detected_sinsals: Array<{ name: string }> | null;
}

export interface WeightLearningResult {
  /** 학습된 신살 가중치 (운영 점수 스케일 -15~+15). */
  weights: Record<string, number>;
  /** 정규화 전 raw regression coefficient (-1~+1 스케일). */
  rawCoefficients: Record<string, number>;
  /** 절편. */
  intercept: number;
  /** 표본 수. */
  sampleSize: number;
  /** 신살별 표본 stats. */
  perSinsalStats: Record<string, { triggered: number; mean: number }>;
  /** 학습 데이터 MSE. */
  mse: number;
  /** 결정계수 R^2. null 이면 표본 분산이 0. */
  rSquared: number | null;
  /** 사용된 λ. */
  lambda: number;
  /** 분석 가능한 신살 (학습 시 최소 5건 이상 발동) 이름. */
  features: string[];
}

/** 단순 가우스 소거법 — n×n 행렬 A 에 대해 A x = b 풀이. */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // 보강 행렬 [A | b].
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let i = 0; i < n; i += 1) {
    // 피벗 선택 (부분 피보팅).
    let maxRow = i;
    for (let k = i + 1; k < n; k += 1) {
      if (Math.abs(M[k]![i]!) > Math.abs(M[maxRow]![i]!)) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow]!, M[i]!];
    if (Math.abs(M[i]![i]!) < 1e-12) return null; // singular
    // 정규화 + 소거.
    for (let k = i + 1; k < n; k += 1) {
      const factor = M[k]![i]! / M[i]![i]!;
      for (let j = i; j <= n; j += 1) {
        M[k]![j]! -= factor * M[i]![j]!;
      }
    }
  }
  // 후방 대입.
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = M[i]![n]!;
    for (let j = i + 1; j < n; j += 1) sum -= M[i]![j]! * x[j]!;
    x[i] = sum / M[i]![i]!;
  }
  return x;
}

/**
 * 메인 학습 함수.
 * @param rows 피드백 row 들 (overall_rating + detected_sinsals).
 * @param options.minTriggered 신살 j 가 발동된 row 가 이 수치 미만이면 학습 제외 (default 5).
 * @param options.lambda L2 정규화 강도 (default 1.0).
 * @param options.scale raw coef → 운영 점수 단위로 변환 시 곱하는 스케일 (default 15).
 */
export function learnSinsalWeights(
  rows: FeedbackRow[],
  options: { minTriggered?: number; lambda?: number; scale?: number } = {}
): WeightLearningResult | null {
  const minTriggered = options.minTriggered ?? 5;
  const lambda = options.lambda ?? 1.0;
  const scale = options.scale ?? 15;

  if (rows.length === 0) return null;

  // 1. 신살 이름 수집 + 발동 횟수.
  const triggerCount: Record<string, number> = {};
  for (const row of rows) {
    if (!row.detected_sinsals) continue;
    for (const s of row.detected_sinsals) {
      if (s?.name) triggerCount[s.name] = (triggerCount[s.name] ?? 0) + 1;
    }
  }

  // 2. 학습 대상 신살 — minTriggered 이상.
  const features = Object.keys(triggerCount)
    .filter((name) => triggerCount[name]! >= minTriggered)
    .sort();
  if (features.length === 0) return null;

  // 3. 행렬 X 구성 — n rows × (1 + p) cols. 첫 컬럼은 intercept.
  const valid = rows.filter((r) => typeof r.overall_rating === 'number');
  const n = valid.length;
  if (n < features.length + 2) return null;
  const p = features.length;
  const X: number[][] = new Array(n);
  const y: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const row = valid[i]!;
    const xi: number[] = new Array(p + 1).fill(0);
    xi[0] = 1; // intercept
    const names = new Set((row.detected_sinsals ?? []).map((s) => s.name));
    for (let j = 0; j < p; j += 1) {
      if (names.has(features[j]!)) xi[j + 1] = 1;
    }
    X[i] = xi;
    y[i] = row.overall_rating;
  }

  // 4. X^T X + λ I — 단, intercept (0번째) 는 정규화에서 제외.
  const dim = p + 1;
  const XtX: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const Xty: number[] = new Array(dim).fill(0);
  for (let i = 0; i < n; i += 1) {
    const xi = X[i]!;
    const yi = y[i]!;
    for (let j = 0; j < dim; j += 1) {
      Xty[j]! += xi[j]! * yi;
      for (let k = 0; k < dim; k += 1) {
        XtX[j]![k]! += xi[j]! * xi[k]!;
      }
    }
  }
  for (let j = 1; j < dim; j += 1) XtX[j]![j]! += lambda; // intercept 제외 L2.

  const beta = solveLinearSystem(XtX, Xty);
  if (!beta) return null;

  // 5. 예측 + MSE + R².
  let sse = 0;
  let totalY = 0;
  for (const yi of y) totalY += yi;
  const meanY = totalY / n;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    let yhat = 0;
    for (let j = 0; j < dim; j += 1) yhat += beta[j]! * X[i]![j]!;
    sse += (y[i]! - yhat) ** 2;
    ssTot += (y[i]! - meanY) ** 2;
  }
  const mse = sse / n;
  const rSquared = ssTot > 0 ? 1 - sse / ssTot : null;

  // 6. raw → 운영 스케일 변환.
  // raw coef 의 단위는 "신살 발동 시 overall_rating(-1~+1) 평균 변화량".
  // 운영 점수는 -15 ~ +15 범위라 scale=15 를 곱해 비교 가능하게 만든다.
  const rawCoefficients: Record<string, number> = {};
  const weights: Record<string, number> = {};
  for (let j = 0; j < p; j += 1) {
    const name = features[j]!;
    const raw = beta[j + 1]!;
    rawCoefficients[name] = Number(raw.toFixed(4));
    weights[name] = Number((raw * scale).toFixed(2));
  }
  const intercept = Number(beta[0]!.toFixed(4));

  // 7. 신살별 표본 통계 (현장 평균).
  const perSinsalStats: Record<string, { triggered: number; mean: number }> = {};
  for (const name of features) {
    let sum = 0;
    let count = 0;
    for (const row of valid) {
      if (row.detected_sinsals?.some((s) => s.name === name)) {
        sum += row.overall_rating;
        count += 1;
      }
    }
    perSinsalStats[name] = {
      triggered: count,
      mean: count > 0 ? Number((sum / count).toFixed(3)) : 0,
    };
  }

  return {
    weights,
    rawCoefficients,
    intercept,
    sampleSize: n,
    perSinsalStats,
    mse: Number(mse.toFixed(4)),
    rSquared: rSquared === null ? null : Number(rSquared.toFixed(4)),
    lambda,
    features,
  };
}

/**
 * 현재 운영 가중치 (sinsal-comprehensive.ts 와 동기화).
 * PR #109 의 EXPECTED_SCORE_MAP 와 동일. 학습 결과 비교용.
 */
export const CURRENT_WEIGHTS: Record<string, number> = {
  천을귀인: 15,
  문창귀인: 10,
  천덕귀인: 8,
  월덕귀인: 8,
  금여록: 6,
  암록: 6,
  양인살: -8,
  백호살: -12,
  괴강살: -5,
  공망살: -10,
  망신살: -8,
  겁살: -8,
  원진살: -7,
  귀문관살: -10,
  도화살: 3,
  역마살: 3,
  화개살: 3,
};

export interface WeightDiff {
  name: string;
  current: number;
  learned: number;
  delta: number;
  /** 학습 결과의 표본 수 + 발동 평균 rating. */
  triggered: number;
  meanRating: number;
  /** 변경 권고 강도. */
  recommendation: 'keep' | 'slight-tweak' | 'major-revise' | 'flip-sign' | 'add' | 'remove';
  hint: string;
}

/**
 * 현재 가중치 vs 학습 결과 비교 — 변경 권고 산출.
 */
export function diffWeights(learned: WeightLearningResult): WeightDiff[] {
  const allNames = new Set<string>([
    ...Object.keys(CURRENT_WEIGHTS),
    ...Object.keys(learned.weights),
  ]);

  const diffs: WeightDiff[] = [];
  for (const name of allNames) {
    const current = CURRENT_WEIGHTS[name] ?? 0;
    const next = learned.weights[name] ?? 0;
    const delta = next - current;
    const stats = learned.perSinsalStats[name] ?? { triggered: 0, mean: 0 };

    let recommendation: WeightDiff['recommendation'];
    let hint: string;
    if (!(name in learned.weights)) {
      recommendation = 'remove';
      hint = '학습 표본 부족 — 데이터로 검증되지 않음';
    } else if (!(name in CURRENT_WEIGHTS)) {
      recommendation = 'add';
      hint = '운영 가중치에 없음 — 데이터가 효과를 시사';
    } else if (current === 0 && Math.abs(next) >= 3) {
      recommendation = 'add';
      hint = '0 → ' + (next > 0 ? '+' : '') + next + ' 로 가중치 부여 고려';
    } else if (Math.sign(current) !== 0 && Math.sign(next) !== 0 && Math.sign(current) !== Math.sign(next)) {
      recommendation = 'flip-sign';
      hint = '부호 반대 — 우선 검토 필요';
    } else if (Math.abs(delta) >= Math.max(5, Math.abs(current) * 0.5)) {
      recommendation = 'major-revise';
      hint = '큰 폭 변화 — 가중치 재조정 검토';
    } else if (Math.abs(delta) >= 2) {
      recommendation = 'slight-tweak';
      hint = '소폭 조정 권고';
    } else {
      recommendation = 'keep';
      hint = '데이터와 부합 — 유지';
    }

    diffs.push({
      name,
      current,
      learned: next,
      delta: Number(delta.toFixed(2)),
      triggered: stats.triggered,
      meanRating: stats.mean,
      recommendation,
      hint,
    });
  }

  // 변경 우선순위 순 정렬 (flip-sign > major > add > slight > keep > remove).
  const order: Record<WeightDiff['recommendation'], number> = {
    'flip-sign': 0,
    'major-revise': 1,
    add: 2,
    'slight-tweak': 3,
    keep: 4,
    remove: 5,
  };
  diffs.sort((a, b) => {
    const oa = order[a.recommendation];
    const ob = order[b.recommendation];
    if (oa !== ob) return oa - ob;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });

  return diffs;
}
