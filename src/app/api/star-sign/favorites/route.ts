// 2026-05-16 PR #138 — 별자리 즐겨찾기 list.
import { NextResponse } from 'next/server';
import { listFavoriteStarSigns } from '@/lib/star-sign/favorites';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const favorites = await listFavoriteStarSigns(supabase, user.id);
  return NextResponse.json({ ok: true, favorites });
}
