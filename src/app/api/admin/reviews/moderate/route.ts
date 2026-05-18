// 2026-05-18 Phase 7b — POST /api/admin/reviews/moderate.
// body: { reviewId, action: 'approve' | 'reject', note? }
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { moderateReview } from '@/lib/reviews/queries';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminCheck(supabase);
  if (!check.ok || !check.userId) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { reviewId?: unknown; action?: unknown; note?: unknown }
    | null;
  if (!body || typeof body.reviewId !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ ok: false, error: 'action must be approve | reject' }, { status: 400 });
  }
  const note = typeof body.note === 'string' && body.note.trim().length > 0 ? body.note.trim() : null;

  const result = await moderateReview({
    reviewId: body.reviewId,
    moderatorId: check.userId,
    action: body.action,
    note,
  });
  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, review: result });
}
