// 2026-05-18 Phase 7b — GET /api/admin/reviews — admin moderation queue.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { listPendingReviewsForAdmin } from '@/lib/reviews/queries';
import type { ReviewModerationStatus } from '@/lib/reviews/types';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminCheck(supabase);
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const statusRaw = searchParams.get('status');
  const limitRaw = searchParams.get('limit');
  const offsetRaw = searchParams.get('offset');
  const status: ReviewModerationStatus | 'all' | undefined =
    statusRaw === 'pending' || statusRaw === 'approved' || statusRaw === 'rejected'
      ? statusRaw
      : statusRaw === 'all'
        ? 'all'
        : 'pending';

  const result = await listPendingReviewsForAdmin({
    status,
    limit: limitRaw ? Number(limitRaw) : undefined,
    offset: offsetRaw ? Number(offsetRaw) : undefined,
  });
  return NextResponse.json({ ok: true, ...result });
}
