// 2026-05-15 — 운영 모니터링 메트릭 API (admin).
// GET /api/admin/operations?days=14 — DAU·결제·만족도·구독 등 통합 스냅샷.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { buildOperationsSnapshot } from '@/lib/admin/operations-stats';
import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

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

  // 2026-07-04 감사 — 집계 대상 테이블 다수가 owner-only/deny RLS(admin_user_summary 는
  // 정책 0개)라 세션(anon) 클라이언트로는 가입자=0·타인 데이터 미집계로 전부 틀렸음.
  // admin 가드 통과 후 service 클라이언트로 집계(dashboard-summary.ts 와 동일 패턴).
  if (!hasSupabaseServiceEnv) {
    return NextResponse.json(
      { ok: false, error: 'service env missing (SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    );
  }

  try {
    const service = await createServiceClient();
    const snapshot = await buildOperationsSnapshot(service, { windowDays });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed to build snapshot';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
