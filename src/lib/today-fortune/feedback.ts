// 2026-05-15 PR 9 — 03_사용자피드백_ML_가중치학습.md §3 적용.
// today_fortune_feedback 테이블 read/write 헬퍼.
//
// 기존 fortune_feedback (013) 은 concern_id + accuracy_label 만 들고 있는 단순 테이블.
// 이 ML-grade 테이블은 추후 XGBoost / Ridge / SGD 학습의 데이터 소스가 됨:
//   - 점수 예측치 (총점 + 8영역 breakdown)
//   - 사용자 피드백 (overall + 5영역 별점)
//   - 피쳐 스냅샷 (사주 + 일진 + 컨텍스트 = 120~150차원)
//   - 발동한 명리 케이스 + 신살

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TodayFortuneFeedbackInput {
  sourceSessionId: string;
  fortuneDate: string; // YYYY-MM-DD
  predictedTotalScore: number;
  predictedBreakdown?: {
    cheongan: number;
    jiji: number;
    ohaeng: number;
    sinsal: number;
    balance: number;
    regulation: number;
    unsung: number;
    special: number;
  };
  overallRating: -1 | 0 | 1;
  wealthRating?: 1 | 2 | 3 | 4 | 5 | null;
  loveRating?: 1 | 2 | 3 | 4 | 5 | null;
  careerRating?: 1 | 2 | 3 | 4 | 5 | null;
  healthRating?: 1 | 2 | 3 | 4 | 5 | null;
  relationshipRating?: 1 | 2 | 3 | 4 | 5 | null;
  userComment?: string | null;
  timeToFeedbackSeconds?: number | null;
  featureSnapshot?: Record<string, unknown> | null;
  triggeredCases?: string[] | null;
  detectedSinsals?: Array<{ name: string; category: string; positions: string[] }> | null;
}

export async function recordTodayFortuneFeedback(
  client: SupabaseClient,
  userId: string,
  input: TodayFortuneFeedbackInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from('today_fortune_feedback')
    .upsert(
      {
        user_id: userId,
        source_session_id: input.sourceSessionId,
        fortune_date: input.fortuneDate,
        predicted_total_score: Math.round(input.predictedTotalScore),
        predicted_breakdown: input.predictedBreakdown ?? null,
        overall_rating: input.overallRating,
        wealth_rating: input.wealthRating ?? null,
        love_rating: input.loveRating ?? null,
        career_rating: input.careerRating ?? null,
        health_rating: input.healthRating ?? null,
        relationship_rating: input.relationshipRating ?? null,
        user_comment: input.userComment?.trim() || null,
        time_to_feedback_seconds: input.timeToFeedbackSeconds ?? null,
        feature_snapshot: input.featureSnapshot ?? null,
        triggered_cases: input.triggeredCases ?? null,
        detected_sinsals: input.detectedSinsals ?? null,
      },
      { onConflict: 'user_id,fortune_date' }
    );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface FeedbackAccuracyStats {
  total: number;
  correctRate: number;     // overall_rating === 1 비율
  partialRate: number;     // overall_rating === 0
  missRate: number;        // overall_rating === -1
  avgAreaRatings: {
    wealth: number | null;
    love: number | null;
    career: number | null;
    health: number | null;
    relationship: number | null;
  };
}

/**
 * 최근 N일 사용자 피드백 통계 — 개인 정확도 트래킹용.
 * ML 글로벌 학습은 별도 배치 (월 1회) 로 처리, 이 함수는 UI 노출용.
 */
export async function getFeedbackAccuracyStats(
  client: SupabaseClient,
  userId: string,
  daysBack = 30
): Promise<FeedbackAccuracyStats> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data, error } = await client
    .from('today_fortune_feedback')
    .select(
      'overall_rating, wealth_rating, love_rating, career_rating, health_rating, relationship_rating'
    )
    .eq('user_id', userId)
    .gte('fortune_date', cutoffStr);

  if (error || !data || data.length === 0) {
    return {
      total: 0,
      correctRate: 0,
      partialRate: 0,
      missRate: 0,
      avgAreaRatings: { wealth: null, love: null, career: null, health: null, relationship: null },
    };
  }

  const total = data.length;
  const counts = { correct: 0, partial: 0, miss: 0 };
  const areaSums = { wealth: 0, love: 0, career: 0, health: 0, relationship: 0 };
  const areaCounts = { wealth: 0, love: 0, career: 0, health: 0, relationship: 0 };

  for (const row of data as Array<Record<string, number | null>>) {
    if (row.overall_rating === 1) counts.correct += 1;
    else if (row.overall_rating === 0) counts.partial += 1;
    else counts.miss += 1;

    for (const key of ['wealth', 'love', 'career', 'health', 'relationship'] as const) {
      const v = row[`${key}_rating`];
      if (typeof v === 'number') {
        areaSums[key] += v;
        areaCounts[key] += 1;
      }
    }
  }

  const avg = (key: keyof typeof areaSums) =>
    areaCounts[key] > 0 ? Number((areaSums[key] / areaCounts[key]).toFixed(2)) : null;

  return {
    total,
    correctRate: Number((counts.correct / total).toFixed(3)),
    partialRate: Number((counts.partial / total).toFixed(3)),
    missRate: Number((counts.miss / total).toFixed(3)),
    avgAreaRatings: {
      wealth: avg('wealth'),
      love: avg('love'),
      career: avg('career'),
      health: avg('health'),
      relationship: avg('relationship'),
    },
  };
}
