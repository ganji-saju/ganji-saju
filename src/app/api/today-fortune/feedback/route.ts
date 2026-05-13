import { NextRequest, NextResponse } from 'next/server';
import type { ConcernId } from '@/lib/today-fortune/types';
import {
  getRecentFortuneFeedbackSummary,
  recordFortuneFeedback,
  type FortuneFeedbackAccuracyLabel,
} from '@/lib/fortune-feedback';
import { createClient } from '@/lib/supabase/server';

const VALID_ACCURACY = new Set<FortuneFeedbackAccuracyLabel>([
  'correct',
  'partial',
  'miss',
]);

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, error: '피드백 정보가 필요합니다.' }, { status: 400 });
  }

  const sourceSessionId = readString(payload, 'sourceSessionId');
  const concernId = readString(payload, 'concernId') as ConcernId;
  const accuracyLabel = readString(payload, 'accuracyLabel') as FortuneFeedbackAccuracyLabel;

  if (!sourceSessionId || !concernId || !VALID_ACCURACY.has(accuracyLabel)) {
    return NextResponse.json({ ok: false, error: '피드백 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const saved = await recordFortuneFeedback({
    userId: user?.id ?? null,
    sourceSessionId,
    concernId,
    accuracyLabel,
    metadata: {
      path: '/today-fortune',
    },
  });

  const recentFeedbackSummary = await getRecentFortuneFeedbackSummary(user?.id ?? null);

  return NextResponse.json({
    ok: true,
    saved,
    recentFeedbackSummary,
  });
}
