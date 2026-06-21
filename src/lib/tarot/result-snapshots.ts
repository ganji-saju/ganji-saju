import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import type {
  TarotOrientation,
  TarotQuestionTone,
  TarotReading,
  TarotSpreadPick,
  TarotSpreadReading,
} from '@/lib/tarot-api';

// 2026-06-05 — 타로 결과 보관함 저장. 무료 한장타로 결과를 로그인 사용자의 보관함에 남긴다.
//   결과는 (question, cardId, orientation)으로 완전 결정 → scope_key 는 날짜 무관 identity,
//   vault 링크는 /tarot/daily/result 파라미터로 결과를 그대로 재현한다(별도 replay 페이지 불필요).
export const TAROT_RESULT_SNAPSHOT_VERSION = 'tarot-result-snapshot/v1';

export interface TarotResultSnapshot {
  id: string;
  userId: string;
  scopeKey: string;
  question: string;
  questionTone: TarotQuestionTone;
  cardId: string;
  cardName: string;
  orientation: TarotOrientation;
  readingJson: TarotReading | Record<string, unknown>;
  snapshotVersion: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface TarotResultSnapshotRow {
  id: string;
  user_id: string;
  scope_key: string;
  question: string;
  question_tone: TarotQuestionTone;
  card_id: string;
  card_name: string;
  orientation: TarotOrientation;
  reading_json: TarotReading | Record<string, unknown> | null;
  snapshot_version: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface StoreTarotResultSnapshotInput {
  userId: string;
  question: string;
  questionTone: TarotQuestionTone;
  cardId: string;
  cardName: string;
  orientation: TarotOrientation;
  reading: TarotReading;
  now?: Date;
}

/** 작고 안정적인 djb2 해시(base36) — scope_key identity 용. */
function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/** 날짜 무관 identity. 같은 (질문·카드·방향) = 같은 키 → (user_id, scope_key) 멱등 upsert. */
export function buildTarotResultSnapshotScopeKey(input: {
  question: string;
  cardId: string;
  orientation: string;
}): string {
  const basis = `${input.question.trim()}${input.cardId}${input.orientation}`;
  return `tarot:${stableHash(basis)}`;
}

/** 보관함 항목 → 결과 재현 링크. 파라미터가 결과를 결정하므로 그대로 다시 렌더된다.
 *  단일 카드는 /result, 3장 스프레드(card_id에 쉼표)는 /spread 로 라우팅한다. */
export function buildTarotResultSnapshotHref(input: {
  question: string;
  cardId: string;
  orientation: string;
}): string {
  // 스프레드 스냅샷: card_id="ar01,cu02,sw03", orientation="u,r,u".
  if (input.cardId.includes(',')) {
    const params = new URLSearchParams({
      question: input.question,
      cards: input.cardId,
      orientations: input.orientation,
    });
    return `/tarot/daily/spread?${params.toString()}`;
  }

  const params = new URLSearchParams({
    question: input.question,
    cardId: input.cardId,
    orientation: input.orientation,
  });
  return `/tarot/daily/result?${params.toString()}`;
}

const SNAPSHOT_SELECT = [
  'id',
  'user_id',
  'scope_key',
  'question',
  'question_tone',
  'card_id',
  'card_name',
  'orientation',
  'reading_json',
  'snapshot_version',
  'generated_at',
  'created_at',
  'updated_at',
].join(', ');

function mapRow(row: TarotResultSnapshotRow): TarotResultSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    scopeKey: row.scope_key,
    question: row.question,
    questionTone: row.question_tone,
    cardId: row.card_id,
    cardName: row.card_name,
    orientation: row.orientation,
    readingJson: row.reading_json ?? {},
    snapshotVersion: row.snapshot_version,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTarotResultSnapshotsForUser(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<TarotResultSnapshot[]> {
  if (!hasSupabaseServiceEnv) return [];
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 30;
  const service = await createServiceClient();
  const { data, error } = await service
    .from('tarot_result_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return [];
  return ((data as unknown as TarotResultSnapshotRow[] | null) ?? []).map(mapRow);
}

export async function upsertTarotResultSnapshot(
  input: StoreTarotResultSnapshotInput
): Promise<TarotResultSnapshot | null> {
  if (!hasSupabaseServiceEnv) return null;
  const now = input.now ?? new Date();
  const scopeKey = buildTarotResultSnapshotScopeKey({
    question: input.question,
    cardId: input.cardId,
    orientation: input.orientation,
  });
  const service = await createServiceClient();
  // created_at 은 payload 에서 제외 → 재방문 upsert 시 최초 보관 시각 보존.
  const payload = {
    user_id: input.userId,
    scope_key: scopeKey,
    question: input.question.trim(),
    question_tone: input.questionTone,
    card_id: input.cardId,
    card_name: input.cardName,
    orientation: input.orientation,
    reading_json: input.reading,
    snapshot_version: TAROT_RESULT_SNAPSHOT_VERSION,
    generated_at: now.toISOString(),
  };
  const { data, error } = await service
    .from('tarot_result_snapshots')
    .upsert(payload, { onConflict: 'user_id,scope_key' })
    .select(SNAPSHOT_SELECT)
    .single();
  if (error || !data) {
    console.warn('tarot result snapshot write failed', error);
    return null;
  }
  return mapRow(data as unknown as TarotResultSnapshotRow);
}

// 3장 스프레드를 같은 테이블에 저장(마이그레이션 없이). card_id/orientation 은 쉼표 join
// 텍스트로 보관 → vault href 가 쉼표를 감지해 /spread 로 라우팅한다.
export interface StoreTarotSpreadSnapshotInput {
  userId: string;
  question: string;
  picks: TarotSpreadPick[];
  spread: TarotSpreadReading;
  now?: Date;
}

export async function upsertTarotSpreadSnapshot(
  input: StoreTarotSpreadSnapshotInput
): Promise<TarotResultSnapshot | null> {
  if (!hasSupabaseServiceEnv) return null;
  const now = input.now ?? new Date();
  const cardId = input.picks.map((pick) => pick.cardId).join(',');
  const orientation = input.picks
    .map((pick) => (pick.orientation === 'reversed' ? 'r' : 'u'))
    .join(',');
  const cardName = input.spread.positions
    .map((entry) => entry.reading.displayName)
    .join(' · ');
  const scopeKey = buildTarotResultSnapshotScopeKey({
    question: input.question,
    cardId,
    orientation,
  });
  const service = await createServiceClient();
  const payload = {
    user_id: input.userId,
    scope_key: scopeKey,
    question: input.question.trim(),
    question_tone: input.spread.positions[0]?.reading.tone ?? 'daily',
    card_id: cardId,
    card_name: cardName || '세 장 풀이',
    orientation,
    reading_json: input.spread,
    snapshot_version: TAROT_RESULT_SNAPSHOT_VERSION,
    generated_at: now.toISOString(),
  };
  const { data, error } = await service
    .from('tarot_result_snapshots')
    .upsert(payload, { onConflict: 'user_id,scope_key' })
    .select(SNAPSHOT_SELECT)
    .single();
  if (error || !data) {
    console.warn('tarot spread snapshot write failed', error);
    return null;
  }
  return mapRow(data as unknown as TarotResultSnapshotRow);
}
