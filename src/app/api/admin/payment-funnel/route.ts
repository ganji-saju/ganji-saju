// 2026-05-16 PR (B1) — admin/payment-funnel 데이터 API.
// GET /api/admin/payment-funnel?days=14 — funnel 단계별 일별 + 합계 스냅샷.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { buildPaymentFunnelSnapshot } from '@/lib/admin/payment-funnel-stats';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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
    // 2026-05-26 — getCurrentAdminCheck 를 통과한 요청만 도달하므로 데이터 조회는 service-role 로 수행.
    // payment_funnel_events 는 RLS(authenticated admin select)만 있고 테이블 GRANT 가 없어, 사용자
    // 세션(authenticated) 클라이언트로는 조회가 막혀 500 이 났다. refund/push-ab-policy 와 동일하게
    // guard(사용자 세션) → 데이터(service-role) 패턴으로 통일한다.
    const service = await createServiceClient();
    const snapshot = await buildPaymentFunnelSnapshot(service, { windowDays });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err: unknown) {
    console.error('[admin/payment-funnel] snapshot 생성 실패:', err);
    const message = err instanceof Error ? err.message : 'failed to build funnel snapshot';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
