import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTarotReadingForQuestion, normalizeQuestion } from '@/lib/tarot-api';
import { upsertTarotResultSnapshot } from '@/lib/tarot/result-snapshots';

export const runtime = 'nodejs';

// 2026-06-05 — 타로 결과 보관함 저장. 결과 페이지가 마운트되면(실제 열람) 클라이언트가 1회 POST.
//   prefetch 가 아닌 실제 view 에서만 호출되며, (user_id, scope_key) 멱등 upsert 라 재호출도 안전.
export async function POST(request: NextRequest) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-body' }, { status: 400 });
  }

  const cardId = typeof payload.cardId === 'string' ? payload.cardId.trim() : '';
  const orientation = payload.orientation === 'reversed' ? 'reversed' : 'upright';
  const question = normalizeQuestion(typeof payload.question === 'string' ? payload.question : '');

  // 카드가 실제로 선택된 결과만 저장(빈 진입/프리뷰 제외).
  if (!cardId) {
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
