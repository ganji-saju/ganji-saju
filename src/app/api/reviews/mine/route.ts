// 2026-05-18 Phase 7b — GET /api/reviews/mine. 본인 후기 전체 (status 무관).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listOwnReviews } from '@/lib/reviews/queries';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }
  const reviews = await listOwnReviews(user.id);
  return NextResponse.json({ ok: true, reviews });
}
