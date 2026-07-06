// 2026-07-07 — /admin/analytics 읽기 API. metrics_daily 누적 시계열(윈도우 30/90/365일).
//   admin 가드 후 service 클라이언트로 조회(metrics_daily RLS deny-all).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { getDailyMetrics } from '@/lib/admin/analytics-metrics';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const parsed = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
  const windowDays = Number.isFinite(parsed) ? parsed : 30;

  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  if (!hasSupabaseServiceEnv) {
    return NextResponse.json(
      { ok: false, error: 'service env missing (SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    );
  }

  try {
    const service = await createServiceClient();
    const snapshot = await getDailyMetrics(service, windowDays);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed to build analytics';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
