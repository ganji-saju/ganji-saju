// 2026-05-16 PR (B1) — admin/payment-funnel 데이터 API.
// GET /api/admin/payment-funnel?days=14 — funnel 단계별 일별 + 합계 스냅샷.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { buildPaymentFunnelSnapshot } from '@/lib/admin/payment-funnel-stats';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days');
  const parsed = parseInt(daysParam ?? '14', 10);
  const windowDays = Number.isFinite(parsed) ? parsed : 14;

  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  try {
    const snapshot = await buildPaymentFunnelSnapshot(supabase, { windowDays });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed to build funnel snapshot';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
