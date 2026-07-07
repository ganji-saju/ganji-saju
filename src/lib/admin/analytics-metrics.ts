// 2026-07-07 — /admin/analytics 읽기 경로. metrics_daily 를 윈도우로 조회해 결측일 gap-fill,
//   전환율 파생, 윈도우 상위 유입 집계. service 클라이언트 전용(metrics_daily RLS deny-all).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  kstMidnightIso,
  recentKstDateKeys,
  type InflowReferrer,
  type InflowUtm,
} from './analytics-rollup';

export interface DailyMetricPoint {
  date: string;
  visitors: number;
  pageViews: number;
  newSignups: number;
  paidOrders: number;
  revenueWon: number;
  prepareAttempts: number;
  checkoutStarts: number;
  confirmSuccess: number;
  /** paidOrders / visitors (분모 0 → null). */
  visitorToPaidRate: number | null;
  /** confirmSuccess / prepareAttempts (분모 0 → null). */
  checkoutConversionRate: number | null;
}

export interface InflowAggEntry {
  key: string;
  label: string;
  visitors: number;
}

export interface AnalyticsTotals {
  visitors: number;
  pageViews: number;
  newSignups: number;
  paidOrders: number;
  revenueWon: number;
  prepareAttempts: number;
  checkoutStarts: number;
  confirmSuccess: number;
  visitorToPaidRate: number | null;
  checkoutConversionRate: number | null;
}

export interface AnalyticsSnapshot {
  windowDays: number;
  from: string;
  to: string;
  daily: DailyMetricPoint[];
  totals: AnalyticsTotals;
  topReferrers: InflowAggEntry[];
  topUtm: InflowAggEntry[];
  refreshedAt: string | null;
  hasData: boolean;
}

export interface MetricsFreshnessRow {
  date_key: string;
  refreshed_at: string | null;
}

export type MetricsFreshnessReason = 'fresh' | 'missing_today' | 'stale_today';

export interface MetricsFreshnessDecision {
  shouldRefresh: boolean;
  reason: MetricsFreshnessReason;
  todayKey: string;
  staleBeforeIso: string;
  refreshedAt: string | null;
}

interface MetricsDailyDbRow {
  date_key: string;
  visitors: number;
  page_views: number;
  new_signups: number;
  paid_orders: number;
  revenue_won: number;
  prepare_attempts: number;
  checkout_starts: number;
  confirm_success: number;
  inflow_referrers: unknown;
  inflow_utm: unknown;
  refreshed_at: string | null;
}

function rate(numer: number, denom: number): number | null {
  return denom > 0 ? numer / denom : null;
}

function asReferrers(v: unknown): InflowReferrer[] {
  return Array.isArray(v)
    ? (v as InflowReferrer[]).filter((e) => e && typeof e.host === 'string')
    : [];
}
function asUtm(v: unknown): InflowUtm[] {
  return Array.isArray(v)
    ? (v as InflowUtm[]).filter((e) => e && typeof e.source === 'string')
    : [];
}

const TOP_N = 12;
export const METRICS_AUTO_REFRESH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function assessDailyMetricsFreshness(
  rows: MetricsFreshnessRow[],
  now: Date = new Date(),
  maxAgeMs = METRICS_AUTO_REFRESH_MAX_AGE_MS
): MetricsFreshnessDecision {
  const todayKey = recentKstDateKeys(1, now)[0]!;
  const kstStartMs = Date.parse(kstMidnightIso(todayKey));
  const maxAgeCutoffMs = now.getTime() - Math.max(1, maxAgeMs);
  const staleBeforeMs = Math.max(kstStartMs, maxAgeCutoffMs);
  const staleBeforeIso = new Date(staleBeforeMs).toISOString();
  const today = rows.find((row) => row.date_key === todayKey);

  if (!today) {
    return {
      shouldRefresh: true,
      reason: 'missing_today',
      todayKey,
      staleBeforeIso,
      refreshedAt: null,
    };
  }

  const refreshedAt = today.refreshed_at;
  const refreshedMs = refreshedAt ? Date.parse(refreshedAt) : Number.NaN;
  if (!Number.isFinite(refreshedMs) || refreshedMs < staleBeforeMs) {
    return {
      shouldRefresh: true,
      reason: 'stale_today',
      todayKey,
      staleBeforeIso,
      refreshedAt,
    };
  }

  return {
    shouldRefresh: false,
    reason: 'fresh',
    todayKey,
    staleBeforeIso,
    refreshedAt,
  };
}

export async function getDailyMetrics(
  service: SupabaseClient,
  windowDays: number,
  now: Date = new Date()
): Promise<AnalyticsSnapshot> {
  const days = Math.max(1, Math.min(365, Math.floor(windowDays) || 30));
  const axis = recentKstDateKeys(days, now);
  const fromKey = axis[0]!;
  const toKey = axis[axis.length - 1]!;

  const { data, error } = await service
    .from('metrics_daily')
    .select(
      'date_key, visitors, page_views, new_signups, paid_orders, revenue_won, prepare_attempts, checkout_starts, confirm_success, inflow_referrers, inflow_utm, refreshed_at'
    )
    .gte('date_key', fromKey)
    .lte('date_key', toKey)
    .order('date_key', { ascending: true });
  if (error) throw new Error(`metrics_daily query failed: ${error.message}`);

  const byDate = new Map<string, MetricsDailyDbRow>();
  for (const row of (data ?? []) as MetricsDailyDbRow[]) byDate.set(row.date_key, row);

  const daily: DailyMetricPoint[] = axis.map((date) => {
    const r = byDate.get(date);
    const visitors = r?.visitors ?? 0;
    const paidOrders = r?.paid_orders ?? 0;
    const prepareAttempts = r?.prepare_attempts ?? 0;
    const confirmSuccess = r?.confirm_success ?? 0;
    return {
      date,
      visitors,
      pageViews: r?.page_views ?? 0,
      newSignups: r?.new_signups ?? 0,
      paidOrders,
      revenueWon: r?.revenue_won ?? 0,
      prepareAttempts,
      checkoutStarts: r?.checkout_starts ?? 0,
      confirmSuccess,
      visitorToPaidRate: rate(paidOrders, visitors),
      checkoutConversionRate: rate(confirmSuccess, prepareAttempts),
    };
  });

  const totalsBase = daily.reduce(
    (acc, d) => {
      acc.visitors += d.visitors;
      acc.pageViews += d.pageViews;
      acc.newSignups += d.newSignups;
      acc.paidOrders += d.paidOrders;
      acc.revenueWon += d.revenueWon;
      acc.prepareAttempts += d.prepareAttempts;
      acc.checkoutStarts += d.checkoutStarts;
      acc.confirmSuccess += d.confirmSuccess;
      return acc;
    },
    {
      visitors: 0,
      pageViews: 0,
      newSignups: 0,
      paidOrders: 0,
      revenueWon: 0,
      prepareAttempts: 0,
      checkoutStarts: 0,
      confirmSuccess: 0,
    }
  );

  const totals: AnalyticsTotals = {
    ...totalsBase,
    visitorToPaidRate: rate(totalsBase.paidOrders, totalsBase.visitors),
    checkoutConversionRate: rate(totalsBase.confirmSuccess, totalsBase.prepareAttempts),
  };

  // 윈도우 상위 유입 집계 — 각 날짜의 상위N(RPC 캡)을 합산해 상위 TOP_N.
  //   (하루 top10 밖 소량 소스는 제외 — 상위 채널 표시엔 무해.)
  const refAgg = new Map<string, number>();
  const utmAgg = new Map<string, { label: string; visitors: number }>();
  for (const row of byDate.values()) {
    for (const e of asReferrers(row.inflow_referrers)) {
      refAgg.set(e.host, (refAgg.get(e.host) ?? 0) + (e.visitors || 0));
    }
    for (const e of asUtm(row.inflow_utm)) {
      const key = [e.source, e.medium, e.campaign].filter(Boolean).join(' / ');
      const prev = utmAgg.get(key);
      utmAgg.set(key, { label: key, visitors: (prev?.visitors ?? 0) + (e.visitors || 0) });
    }
  }

  const topReferrers: InflowAggEntry[] = Array.from(refAgg.entries())
    .map(([host, visitors]) => ({ key: host, label: host, visitors }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, TOP_N);

  const topUtm: InflowAggEntry[] = Array.from(utmAgg.entries())
    .map(([key, v]) => ({ key, label: v.label, visitors: v.visitors }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, TOP_N);

  const refreshedAt =
    Array.from(byDate.values())
      .map((r) => r.refreshed_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop() ?? null;

  const hasData =
    totals.visitors > 0 ||
    totals.paidOrders > 0 ||
    totals.newSignups > 0 ||
    totals.prepareAttempts > 0;

  return {
    windowDays: days,
    from: fromKey,
    to: toKey,
    daily,
    totals,
    topReferrers,
    topUtm,
    refreshedAt,
    hasData,
  };
}
