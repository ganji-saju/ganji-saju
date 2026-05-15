// 2026-05-15 — 운영 모니터링 메트릭 API (admin).
// GET /api/admin/operations?days=14 — DAU·결제·만족도·구독 등 통합 스냅샷.
import { NextRequest, NextResponse } from 'next/server';
import { buildOperationsSnapshot } from '@/lib/admin/operations-stats';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days');
  const parsed = parseInt(daysParam ?? '14', 10);
  const windowDays = Number.isFinite(parsed) ? parsed : 14;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // 향후: admin role 체크. 현재는 noindex 페이지 + 로그인만 검증.

  try {
    const snapshot = await buildOperationsSnapshot(supabase, { windowDays });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed to build snapshot';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
