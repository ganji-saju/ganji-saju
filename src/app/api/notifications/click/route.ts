// 2026-05-16 PR #137 — 알림 클릭 ack.
// dispatch 가 push payload 의 URL 에 ?notif=<logId> 를 붙여 발송.
// 사용자가 클릭해 페이지 진입하면 NotificationClickTracker 가 이 endpoint 로
// POST { id } 전송 → clicked_at 기록 (멱등).
import { NextRequest, NextResponse } from 'next/server';
import { markNotificationClick } from '@/lib/notification-preferences';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as
    | { id?: unknown }
    | null;
  const id = typeof payload?.id === 'string' ? payload.id.trim() : '';

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: '잘못된 알림 id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // 비로그인 클릭은 silent ok (로그인 안 한 채로 push 받았다면 다른 사람이 보는 가능성).
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await markNotificationClick({ logId: id, userId: user.id });
    return NextResponse.json({ ok: true, updated: result.updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
