// 2026-05-20 V2-5 PR R — 챕터별 사용자 피드백 helper.
//   chapter_feedback 테이블 (migration 035) 의 upsert + 조회.

import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';

export type ChapterId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface RecordChapterFeedbackInput {
  userId: string | null;
  readingId: string;
  chapterId: ChapterId;
  rating?: number | null;
  helpfulBool?: boolean | null;
  comment?: string | null;
}

export interface ChapterFeedbackRecord {
  id: string;
  reading_id: string;
  chapter_id: number;
  rating: number | null;
  helpful_bool: boolean | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 사용자 피드백 upsert — 같은 user × reading × chapter 1회만 (UNIQUE 제약).
 *
 * @returns 저장된 row 또는 null (Supabase 미설정 / RLS fail / 입력 오류).
 */
export async function recordChapterFeedback(
  input: RecordChapterFeedbackInput
): Promise<ChapterFeedbackRecord | null> {
  if (!hasSupabaseServerEnv) return null;

  // 검증 — rating 또는 helpfulBool 중 하나는 필수 (CHECK 제약).
  const hasRating = typeof input.rating === 'number';
  const hasHelpful = typeof input.helpfulBool === 'boolean';
  if (!hasRating && !hasHelpful) return null;

  if (hasRating && (input.rating! < 1 || input.rating! > 5)) return null;
  if (input.chapterId < 1 || input.chapterId > 9) return null;
  if (!input.readingId.trim()) return null;

  const supabase = await createClient();
  const row: Record<string, unknown> = {
    user_id: input.userId,
    reading_id: input.readingId.trim(),
    chapter_id: input.chapterId,
    rating: hasRating ? input.rating : null,
    helpful_bool: hasHelpful ? input.helpfulBool : null,
    comment: input.comment?.trim() || null,
  };

  const { data, error } = await supabase
    .from('chapter_feedback')
    .upsert(row, { onConflict: 'user_id,reading_id,chapter_id' })
    .select()
    .single();

  if (error || !data) return null;
  return data as ChapterFeedbackRecord;
}

/**
 * 한 사용자의 한 풀이에 대한 전체 챕터 피드백 일괄 조회 (마이페이지 등).
 */
export async function listChapterFeedbackForReading(
  userId: string,
  readingId: string
): Promise<ChapterFeedbackRecord[]> {
  if (!hasSupabaseServerEnv) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('chapter_feedback')
    .select('*')
    .eq('user_id', userId)
    .eq('reading_id', readingId);

  if (error || !data) return [];
  return data as ChapterFeedbackRecord[];
}
