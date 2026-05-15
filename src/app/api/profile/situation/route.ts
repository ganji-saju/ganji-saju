// 2026-05-16 PR #151 (B2) — 사용자 default situation 저장/조회.
// GET → 현재 user_situation
// PUT → 전체 교체 (null/빈 객체 = clear)
import { NextRequest, NextResponse } from 'next/server';
import {
  getUserSituationForUser,
  parseUserSituation,
  saveUserSituationForUser,
} from '@/lib/profile/user-situation';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const situation = await getUserSituationForUser(supabase, user.id);
  return NextResponse.json({ ok: true, situation });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const payload = await req.json().catch(() => null);
  const situation = parseUserSituation(payload);
  const result = await saveUserSituationForUser(supabase, user.id, situation);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, situation });
}
