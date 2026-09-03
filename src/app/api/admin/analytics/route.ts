// 2026-07-07 — /admin/analytics 읽기 API. metrics_daily 누적 시계열.
// 2026-09-01 — 롤링 days= 를 달력 기간(unit+period)으로 교체. /admin 과 축을 맞춘다.
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
import { getRefundBreakdown } from '@/lib/admin/refund-breakdown';
import { getPagePathStats } from '@/lib/admin/page-path-stats';
import { kstNoonDate, resolveAdminPeriod } from '@/lib/admin/metric-periods';

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
  const period = resolveAdminPeriod(
    req.nextUrl.searchParams.get('unit'),
    req.nextUrl.searchParams.get('period')
  );
  const windowDays = period.days;

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
    // 신선도 판정은 **진짜 오늘** 기준(지난 기간을 본다고 오늘 롤업을 건너뛰면 안 된다).
    const autoRefresh = await ensureDailyMetricsFresh(service, now);
    // 집계 끝점은 **기간 마지막 날**. now 만 받는 함수엔 그 날 정오를 넘긴다.
    const periodEnd = kstNoonDate(period.endKey);
    // 2026-09-03 (migration 078) — 경로별 방문. 축(기간)과 같은 날짜 범위로 집계한다.
    const [snapshot, external, refunds, pagePaths] = await Promise.all([
      getDailyMetrics(service, windowDays, periodEnd),
      getExternalAnalyticsSnapshot(windowDays, periodEnd),
      // 2026-08-26 — 환불 건별 원 결제일. '오늘 매출 990 / 환불 9,900' 이 왜 그런지
      //   화면이 스스로 답하게 한다(집계는 그대로, 해설만 추가).
      getRefundBreakdown(service, windowDays, periodEnd),
      getPagePathStats(service, period.startKey, period.endKey),
    ]);
    return NextResponse.json(
      { ok: true, snapshot, external, refunds, pagePaths, autoRefresh, period },
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
