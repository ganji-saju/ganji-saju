// 2026-05-15 — 대화방 채팅 기록 헬퍼.
// dialogue_messages 테이블 read/write + 세션 그룹화.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface DialogueMessageRow {
  id: string;
  session_id: string;
  expert_id: string;
  role: 'user' | 'assistant';
  text: string;
  source: string | null;
  model: string | null;
  source_session_id: string | null;
  concern_id: string | null;
  entry_from: string | null;
  created_at: string;
}

export interface DialogueSessionSummary {
  sessionId: string;
  expertId: string;
  firstQuestion: string; // 사용자 첫 메시지 미리보기
  lastReply: string | null; // 마지막 assistant 응답 미리보기
  messageCount: number;
  lastAt: string; // 마지막 메시지 시각
}

export interface RecordMessageInput {
  sessionId: string;
  expertId: string;
  role: 'user' | 'assistant';
  text: string;
  source?: string | null;
  model?: string | null;
  sourceSessionId?: string | null;
  concernId?: string | null;
  entryFrom?: string | null;
}

export async function recordDialogueMessage(
  client: SupabaseClient,
  userId: string,
  input: RecordMessageInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await client
    .from('dialogue_messages')
    .insert({
      user_id: userId,
      session_id: input.sessionId,
      expert_id: input.expertId,
      role: input.role,
      text: input.text,
      source: input.source ?? null,
      model: input.model ?? null,
      source_session_id: input.sourceSessionId ?? null,
      concern_id: input.concernId ?? null,
      entry_from: input.entryFrom ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'insert failed' };
  }
  return { ok: true, id: data.id };
}

/**
 * 사용자별 최근 대화 세션 summary 목록.
 * 세션 ID 별로 묶어 firstQuestion / lastReply / messageCount / lastAt 산출.
 */
export async function listDialogueSessions(
  client: SupabaseClient,
  userId: string,
  options: { limit?: number } = {}
): Promise<DialogueSessionSummary[]> {
  const limit = options.limit ?? 50;

  const { data, error } = await client
    .from('dialogue_messages')
    .select('id, session_id, expert_id, role, text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit * 20); // 세션당 평균 ~20개 메시지 추정

  if (error || !data) return [];

  // 세션 ID 별 그룹화.
  const sessionMap = new Map<string, DialogueMessageRow[]>();
  for (const row of data as DialogueMessageRow[]) {
    const list = sessionMap.get(row.session_id) ?? [];
    list.push(row);
    sessionMap.set(row.session_id, list);
  }

  const summaries: DialogueSessionSummary[] = [];
  for (const [sessionId, rows] of sessionMap.entries()) {
    if (rows.length === 0) continue;
    const sortedAsc = rows.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstUser = sortedAsc.find((r) => r.role === 'user');
    const lastAssistant = sortedAsc.slice().reverse().find((r) => r.role === 'assistant');
    const last = sortedAsc[sortedAsc.length - 1]!;
    summaries.push({
      sessionId,
      expertId: rows[0]!.expert_id,
      firstQuestion: firstUser?.text.slice(0, 80) ?? '',
      lastReply: lastAssistant?.text.slice(0, 80) ?? null,
      messageCount: rows.length,
      lastAt: last.created_at,
    });
  }
  summaries.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return summaries.slice(0, limit);
}

/**
 * 특정 세션의 전체 메시지 (오래된 순).
 */
export async function getDialogueSessionMessages(
  client: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<DialogueMessageRow[]> {
  const { data, error } = await client
    .from('dialogue_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as DialogueMessageRow[];
}

export async function deleteDialogueSession(
  client: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from('dialogue_messages')
    .delete()
    .eq('user_id', userId)
    .eq('session_id', sessionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
