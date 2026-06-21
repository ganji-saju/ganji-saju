import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTarotReadingForQuestion,
  getTarotSpreadReadingForCards,
  normalizeQuestion,
  type TarotOrientation,
  type TarotSpreadPick,
} from '@/lib/tarot-api';
import {
  upsertTarotResultSnapshot,
  upsertTarotSpreadSnapshot,
} from '@/lib/tarot/result-snapshots';

export const runtime = 'nodejs';

function parsePicks(value: unknown): TarotSpreadPick[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const picks: TarotSpreadPick[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const cardId = typeof record.cardId === 'string' ? record.cardId.trim() : '';
    if (!cardId || seen.has(cardId) || picks.length >= 3) continue; // 중복·초과 정규화
    seen.add(cardId);
    const orientation: TarotOrientation =
      record.orientation === 'reversed' ? 'reversed' : 'upright';
    picks.push({ cardId, orientation });
  }
  return picks;
}

// 2026-06-05 — 타로 결과 보관함 저장. 결과 페이지가 마운트되면(실제 열람) 클라이언트가 1회 POST.
//   prefetch 가 아닌 실제 view 에서만 호출되며, (user_id, scope_key) 멱등 upsert 라 재호출도 안전.
export async function POST(request: NextRequest) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-body' }, { status: 400 });
  }

  const question = normalizeQuestion(typeof payload.question === 'string' ? payload.question : '');
  const picks = parsePicks(payload.picks);
  const cardId = typeof payload.cardId === 'string' ? payload.cardId.trim() : '';

  // 단일카드도 3장 스프레드도 아니면 저장할 게 없음(빈 진입/프리뷰 제외).
  if (picks.length < 3 && !cardId) {
    return NextResponse.json({ ok: false, skipped: 'no-card' });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 무료 타로는 누구나 열람하지만, 보관함은 로그인 사용자 한정.
  if (!user) {
    return NextResponse.json({ ok: false, skipped: 'anonymous' });
  }

  // 3장 스프레드 저장.
  if (picks.length >= 3) {
    const spread = await getTarotSpreadReadingForCards(question, picks);
    const snapshot = await upsertTarotSpreadSnapshot({
      userId: user.id,
      question,
      picks: picks.slice(0, 3),
      spread,
    });
    if (!snapshot) {
      return NextResponse.json({ ok: false, error: 'save-failed' });
    }
    return NextResponse.json({ ok: true, id: snapshot.id });
  }

  // 단일카드 저장(레거시 /result 경로).
  const orientation = payload.orientation === 'reversed' ? 'reversed' : 'upright';
  const reading = await getTarotReadingForQuestion({ question, cardId, orientation });
  const snapshot = await upsertTarotResultSnapshot({
    userId: user.id,
    question,
    questionTone: reading.tone,
    cardId,
    cardName: reading.displayName,
    orientation: reading.orientation,
    reading,
  });

  if (!snapshot) {
    return NextResponse.json({ ok: false, error: 'save-failed' });
  }
  return NextResponse.json({ ok: true, id: snapshot.id });
}
