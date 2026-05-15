// 2026-05-16 PR #145 — A/B winner 현재 정책 조회 + 강제 refresh.
// GET — cache 의 selection 상태 + force refresh (?refresh=1)
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { computeWinner, getWinnerCached } from '@/lib/star-sign/ab-winner';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';
  if (forceRefresh) {
    const service = await createServiceClient();
    const fresh = await computeWinner(service);
    return NextResponse.json({ ok: true, selection: fresh, refreshed: true });
  }

  const cached = getWinnerCached();
  return NextResponse.json({
    ok: true,
    selection: cached,
    refreshed: false,
  });
}
