// 2026-05-16 PR #151 (B2) — profiles.user_situation 읽기/쓰기.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserSituation } from '@/lib/saju/types';

const VALID_RELATIONSHIP = new Set([
  'single',
  'dating',
  'married',
  'separated',
]);

const VALID_OCCUPATION = new Set([
  'employee',
  'self-employed',
  'student',
  'homemaker',
  'job-seeking',
  'other',
]);

const VALID_CONCERN = new Set([
  'business',
  'romance',
  'family',
  'health',
  'wealth',
  'other',
]);

/** unknown 입력을 안전하게 UserSituation 으로 정규화. 잘못된 enum 은 떨굼. */
export function parseUserSituation(raw: unknown): UserSituation | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const result: UserSituation = {};
  if (typeof obj.relationshipStatus === 'string' && VALID_RELATIONSHIP.has(obj.relationshipStatus)) {
    result.relationshipStatus = obj.relationshipStatus as UserSituation['relationshipStatus'];
  }
  if (typeof obj.occupation === 'string' && VALID_OCCUPATION.has(obj.occupation)) {
    result.occupation = obj.occupation as UserSituation['occupation'];
  }
  if (typeof obj.currentConcern === 'string' && VALID_CONCERN.has(obj.currentConcern)) {
    result.currentConcern = obj.currentConcern as UserSituation['currentConcern'];
  }
  if (typeof obj.concernNote === 'string') {
    const trimmed = obj.concernNote.trim().slice(0, 80);
    if (trimmed) result.concernNote = trimmed;
  }
  // 모두 비어있으면 null 반환 (false-positive 저장 방지).
  const hasAny =
    result.relationshipStatus || result.occupation || result.currentConcern || result.concernNote;
  return hasAny ? result : null;
}

export async function getUserSituationForUser(
  client: SupabaseClient,
  userId: string
): Promise<UserSituation | null> {
  const { data, error } = await client
    .from('profiles')
    .select('user_situation')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return parseUserSituation((data as { user_situation: unknown }).user_situation);
}

export async function saveUserSituationForUser(
  client: SupabaseClient,
  userId: string,
  situation: UserSituation | null
): Promise<{ ok: boolean; error?: string }> {
  // null → clear
  const value = situation && Object.keys(situation).length > 0 ? situation : null;
  const { error } = await client
    .from('profiles')
    .update({ user_situation: value })
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
