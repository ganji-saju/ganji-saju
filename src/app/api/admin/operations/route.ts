// 2026-05-15 — 운영 모니터링 메트릭 API (admin).
// GET /api/admin/operations?days=14 — DAU·결제·만족도·구독 등 통합 스냅샷.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { buildOperationsSnapshot } from '@/lib/admin/operations-stats';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days');
  const parsed = parseInt(daysParam ?? '14', 10);
  const windowDays = Number.isFinite(parsed) ? parsed : 14;

  const supabase = await createClient();
  // PR #141 — admin 화이트리스트 가드. env ADMIN_USER_IDS 또는 admin_users 테이블 통과.
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  try {
    const snapshot = await buildOperationsSnapshot(supabase, { windowDays });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed to build snapshot';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
