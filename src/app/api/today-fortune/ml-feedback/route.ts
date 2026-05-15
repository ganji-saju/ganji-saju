// 2026-05-15 PR 9 — ML-grade 피드백 수집 endpoint.
// today_fortune_feedback 테이블에 점수 예측 + 사용자 평가 + 영역별 별점 + 피쳐 스냅샷 저장.
// 기존 /api/today-fortune/feedback (013) 은 단순 accuracy_label 만 받는 데 비해,
// 이 endpoint 는 ML 학습 가능한 풀 페이로드를 받는다.

import { NextRequest, NextResponse } from 'next/server';
import {
  recordTodayFortuneFeedback,
  type TodayFortuneFeedbackInput,
} from '@/lib/today-fortune/feedback';
import { createClient } from '@/lib/supabase/server';

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function readString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === 'string' ? v.trim() : '';
}

function readAreaRating(payload: Record<string, unknown>, key: string): 1 | 2 | 3 | 4 | 5 | null {
  const v = readNumber(payload, key);
  if (v === null) return null;
  if (v >= 1 && v <= 5) return Math.round(v) as 1 | 2 | 3 | 4 | 5;
  return null;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: '피드백 정보가 필요합니다.' }, { status: 400 });
  }

  // 필수: sourceSessionId, fortuneDate, predictedTotalScore, overallRating.
  const sourceSessionId = readString(payload, 'sourceSessionId');
  const fortuneDate = readString(payload, 'fortuneDate');
  const predictedTotalScore = readNumber(payload, 'predictedTotalScore');
  const overall = readNumber(payload, 'overallRating');

  if (!sourceSessionId || !fortuneDate || predictedTotalScore === null) {
    return NextResponse.json({ ok: false, error: '필수 필드 누락' }, { status: 400 });
  }
  if (overall === null || ![-1, 0, 1].includes(overall)) {
    return NextResponse.json({ ok: false, error: 'overallRating 은 -1/0/1 만 허용' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 노이즈 필터링 — 너무 빠른 클릭은 거부.
  const timeToFeedback = readNumber(payload, 'timeToFeedbackSeconds');
  if (timeToFeedback !== null && timeToFeedback < 3) {
    return NextResponse.json(
      { ok: false, error: '결과를 더 읽어보신 후 피드백을 남겨주세요.' },
      { status: 400 }
    );
  }

  const breakdown = payload.predictedBreakdown as TodayFortuneFeedbackInput['predictedBreakdown'];

  const input: TodayFortuneFeedbackInput = {
    sourceSessionId,
    fortuneDate,
    predictedTotalScore,
    predictedBreakdown: breakdown,
    overallRating: overall as -1 | 0 | 1,
    wealthRating: readAreaRating(payload, 'wealthRating'),
    loveRating: readAreaRating(payload, 'loveRating'),
    careerRating: readAreaRating(payload, 'careerRating'),
    healthRating: readAreaRating(payload, 'healthRating'),
    relationshipRating: readAreaRating(payload, 'relationshipRating'),
    userComment: readString(payload, 'userComment') || null,
    timeToFeedbackSeconds: timeToFeedback,
    featureSnapshot: (payload.featureSnapshot as Record<string, unknown>) ?? null,
    triggeredCases: (payload.triggeredCases as string[]) ?? null,
    detectedSinsals: (payload.detectedSinsals as Array<{ name: string; category: string; positions: string[] }>) ?? null,
  };

  const result = await recordTodayFortuneFeedback(supabase, user.id, input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
