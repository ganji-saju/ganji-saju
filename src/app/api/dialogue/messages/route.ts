// 2026-05-15 — 대화 메시지 저장 API.
// POST /api/dialogue/messages — 사용자 메시지 또는 AI 응답 1건 저장.
import { NextRequest, NextResponse } from 'next/server';
import { recordDialogueMessage } from '@/lib/dialogue/history';
import { createClient } from '@/lib/supabase/server';

function readString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 });
  }

  const sessionId = readString(payload, 'sessionId');
  const expertId = readString(payload, 'expertId');
  const role = readString(payload, 'role');
  const text = readString(payload, 'text');

  if (!sessionId || !expertId || !text) {
    return NextResponse.json({ ok: false, error: '필수 필드 누락' }, { status: 400 });
  }
  if (role !== 'user' && role !== 'assistant') {
    return NextResponse.json({ ok: false, error: 'role 은 user/assistant 만' }, { status: 400 });
  }

  // UUID 형식 (느슨 검증).
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ ok: false, error: 'sessionId 형식 오류' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // 비로그인 사용자는 저장 안 함 (silent ok). 로컬 상태로만 동작.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const result = await recordDialogueMessage(supabase, user.id, {
    sessionId,
    expertId,
    role,
    text,
    source: readString(payload, 'source') || null,
    model: readString(payload, 'model') || null,
    sourceSessionId: readString(payload, 'sourceSessionId') || null,
    concernId: readString(payload, 'concernId') || null,
    entryFrom: readString(payload, 'entryFrom') || null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
