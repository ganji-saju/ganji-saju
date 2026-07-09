// 2026-07-07 — /admin/analytics 읽기 API. metrics_daily 누적 시계열(윈도우 30/90/365일).
//   admin 가드 후 service 클라이언트로 조회(metrics_daily RLS deny-all).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import {
  assessDailyMetricsFreshness,
  getDailyMetrics,
  type MetricsFreshnessDecision,
  type MetricsFreshnessRow,
} from '@/lib/admin/analytics-metrics';
import {
  recentKstDateKeys,
  runDailyMetricsRollup,
  type RollupResult,
} from '@/lib/admin/analytics-rollup';
import { getExternalAnalyticsSnapshot } from '@/lib/admin/external-analytics';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface AutoRefreshResult {
  refreshed: boolean;
  freshness: MetricsFreshnessDecision;
  rollup?: RollupResult;
}

async function ensureDailyMetricsFresh(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  now: Date
): Promise<AutoRefreshResult> {
  const recentKeys = recentKstDateKeys(3, now);
  const { data, error } = await service
    .from('metrics_daily')
    .select('date_key, refreshed_at')
    .in('date_key', recentKeys)
    .order('date_key', { ascending: true });
  if (error) throw new Error(`metrics_daily freshness query failed: ${error.message}`);

  const freshness = assessDailyMetricsFreshness((data ?? []) as MetricsFreshnessRow[], now);
  if (!freshness.shouldRefresh) return { refreshed: false, freshness };

  const rollup = await runDailyMetricsRollup(service, { dateKeys: recentKeys, now });
  return { refreshed: true, freshness, rollup };
}

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
    const now = new Date();
    const autoRefresh = await ensureDailyMetricsFresh(service, now);
    const [snapshot, external] = await Promise.all([
      getDailyMetrics(service, windowDays, now),
      getExternalAnalyticsSnapshot(windowDays, now),
    ]);
    return NextResponse.json(
      { ok: true, snapshot, external, autoRefresh },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'failed to build analytics';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
