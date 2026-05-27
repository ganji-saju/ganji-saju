import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import type { ConcernId } from '@/lib/today-fortune/types';

export type FortuneFeedbackAccuracyLabel = 'correct' | 'partial' | 'miss';

export interface FortuneFeedbackRecord {
  concern_id: string;
  accuracy_label: FortuneFeedbackAccuracyLabel;
  accuracy_score: number;
  responded_at_24h: string;
}

const ACCURACY_SCORES: Record<FortuneFeedbackAccuracyLabel, number> = {
  correct: 2,
  partial: 1,
  miss: 0,
};

const CONCERN_LABELS: Record<ConcernId, string> = {
  love_contact: '연락 흐름',
  money_spend: '돈과 지출',
  work_meeting: '미팅과 계약',
  relationship_conflict: '관계와 말실수',
  energy_health: '컨디션과 리듬',
  general: '오늘의 전체 흐름',
};

function normalizeConcernLabel(value: string) {
  return CONCERN_LABELS[value as ConcernId] ?? '오늘의 흐름';
}

export function getFortuneFeedbackScore(
  accuracyLabel: FortuneFeedbackAccuracyLabel
) {
  return ACCURACY_SCORES[accuracyLabel];
}

export function buildRecentFortuneFeedbackSummary(
  records: FortuneFeedbackRecord[]
) {
  if (records.length === 0) return null;

  const counts = {
    correct: 0,
    partial: 0,
    miss: 0,
  } satisfies Record<FortuneFeedbackAccuracyLabel, number>;
  const weakConcernCounts = new Map<string, number>();

  for (const record of records) {
    counts[record.accuracy_label] += 1;

    if (record.accuracy_label !== 'correct') {
      weakConcernCounts.set(
        record.concern_id,
        (weakConcernCounts.get(record.concern_id) ?? 0) + 1
      );
    }
  }

  const total = records.length;
  const weakestConcern = [...weakConcernCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const cautionLine = weakestConcern
    ? `최근에는 ${normalizeConcernLabel(weakestConcern)} 주제에서 보수적인 설명을 더 선호하는 반응이 있었습니다.`
    : counts.correct === total
      ? '최근 피드백은 전반적으로 잘 맞았다는 반응이 많았습니다.'
      : '최근 피드백에서는 단정 대신 범위와 조건을 함께 짚는 쪽이 더 잘 받아들여졌습니다.';

  return `최근 오늘 운세 피드백 ${total}건 원칙, 맞았다 ${counts.correct}건 · 비슷했다 ${counts.partial}건 · 빗나갔다 ${counts.miss}건입니다. ${cautionLine}`;
}

export async function getRecentFortuneFeedbackSummary(userId: string | null | undefined) {
  if (!userId || !hasSupabaseServiceEnv) return null;

  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from('fortune_feedback')
      .select('concern_id, accuracy_label, accuracy_score, responded_at_24h')
      .eq('user_id', userId)
      .order('responded_at_24h', { ascending: false })
      .limit(8);

    if (error || !data) return null;
    return buildRecentFortuneFeedbackSummary(data as FortuneFeedbackRecord[]);
  } catch {
    return null;
  }
}

export async function recordFortuneFeedback(input: {
  userId?: string | null;
  sourceSessionId: string;
  concernId: ConcernId;
  accuracyLabel: FortuneFeedbackAccuracyLabel;
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseServiceEnv) return false;

  try {
    const service = await createServiceClient();
    const now = new Date().toISOString();
    const { error } = await service.from('fortune_feedback').upsert(
      {
        user_id: input.userId ?? null,
        source_session_id: input.sourceSessionId,
        concern_id: input.concernId,
        accuracy_label: input.accuracyLabel,
        accuracy_score: getFortuneFeedbackScore(input.accuracyLabel),
        responded_at_24h: now,
        updated_at: now,
        metadata: input.metadata ?? {},
      },
      { onConflict: 'source_session_id' }
    );

    return !error;
  } catch {
    return false;
  }
}
