// 2026-05-16 PR (B1) — payment_funnel_events 일별 funnel 집계.
// /admin/payment-funnel 페이지의 단일 데이터 source.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentFunnelStage } from '@/lib/payments/funnel-log';

const STAGES: readonly PaymentFunnelStage[] = [
  'prepare_attempt',
  'prepare_blocked',
  'prepare_ready',
  'confirm_attempt',
  'confirm_success',
  'confirm_failed',
] as const;

export interface PaymentFunnelDailyPoint {
  /** YYYY-MM-DD (KST). */
  date: string;
  /** 단계별 count. */
  counts: Record<PaymentFunnelStage, number>;
}

export interface PaymentFunnelTotals {
  /** 단계별 누적 합. */
  counts: Record<PaymentFunnelStage, number>;
  /** prepare_attempt → confirm_success 전환율 (0~1). prepare_attempt 가 0 이면 0. */
  overallConversionRate: number;
  /** confirm_attempt → confirm_success 결제 시도 성공률 (0~1). */
  confirmSuccessRate: number;
  /** prepare_attempt → prepare_blocked 비율 (이미 구매·미로그인 등 차단). */
  prepareBlockRate: number;
  /** confirm_attempt → confirm_failed 실패율. */
  confirmFailRate: number;
}

export interface PaymentFunnelBlockReason {
  reason: string;
  count: number;
}

export interface PaymentFunnelByPackage {
  packageId: string;
  prepareAttempt: number;
  confirmSuccess: number;
  conversionRate: number;
}

export interface PaymentFunnelSnapshot {
  /** ISO timestamp generated. */
  generatedAt: string;
  /** 윈도우 일수. */
  windowDays: number;
  /** 합계. */
  totals: PaymentFunnelTotals;
  /** 일별 트렌드 (오름차순, windowDays 길이). */
  daily: PaymentFunnelDailyPoint[];
  /** prepare_blocked / confirm_failed 의 reason 별 top. */
  blockedReasons: PaymentFunnelBlockReason[];
  failedReasons: PaymentFunnelBlockReason[];
  /** 패키지 별 전환 (prepareAttempt desc). */
  byPackage: PaymentFunnelByPackage[];
}

interface FunnelRow {
  stage: PaymentFunnelStage;
  package_id: string | null;
  reason: string | null;
  created_at: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKstDateKey(iso: string): string {
  const t = new Date(iso).getTime();
  const kst = new Date(t + KST_OFFSET_MS);
  // KST UTC 변환 후 ISO 의 yyyy-mm-dd 부분만.
  return kst.toISOString().slice(0, 10);
}

function emptyCounts(): Record<PaymentFunnelStage, number> {
  return STAGES.reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {} as Record<PaymentFunnelStage, number>);
}

function buildDateAxis(windowDays: number): string[] {
  const today = new Date();
  const todayKst = new Date(today.getTime() + KST_OFFSET_MS);
  const dates: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(todayKst);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function buildPaymentFunnelSnapshot(
  supabase: SupabaseClient,
  options: { windowDays?: number } = {}
): Promise<PaymentFunnelSnapshot> {
  const windowDays = Math.max(1, Math.min(120, options.windowDays ?? 14));
  const sinceMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  const { data, error } = await supabase
    .from('payment_funnel_events')
    .select('stage, package_id, reason, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`payment_funnel_events query failed: ${error.message}`);
  }

  const rows: FunnelRow[] = (data ?? []) as FunnelRow[];

  // 일별 buckets — date 축은 항상 windowDays 만큼 (빈 날짜도 0 포함).
  const dateAxis = buildDateAxis(windowDays);
  const dayMap = new Map<string, Record<PaymentFunnelStage, number>>();
  for (const d of dateAxis) dayMap.set(d, emptyCounts());

  const totals = emptyCounts();
  const blockedReasonCount = new Map<string, number>();
  const failedReasonCount = new Map<string, number>();
  const packageStats = new Map<string, { prepareAttempt: number; confirmSuccess: number }>();

  for (const row of rows) {
    const stage = row.stage;
    if (!STAGES.includes(stage)) continue;
    totals[stage] += 1;
    const dateKey = toKstDateKey(row.created_at);
    if (dayMap.has(dateKey)) {
      dayMap.get(dateKey)![stage] += 1;
    }
    if (stage === 'prepare_blocked' && row.reason) {
      blockedReasonCount.set(row.reason, (blockedReasonCount.get(row.reason) ?? 0) + 1);
    }
    if (stage === 'confirm_failed' && row.reason) {
      failedReasonCount.set(row.reason, (failedReasonCount.get(row.reason) ?? 0) + 1);
    }
    if (row.package_id && (stage === 'prepare_attempt' || stage === 'confirm_success')) {
      const slot = packageStats.get(row.package_id) ?? { prepareAttempt: 0, confirmSuccess: 0 };
      if (stage === 'prepare_attempt') slot.prepareAttempt += 1;
      if (stage === 'confirm_success') slot.confirmSuccess += 1;
      packageStats.set(row.package_id, slot);
    }
  }

  const overallConversionRate =
    totals.prepare_attempt > 0
      ? totals.confirm_success / totals.prepare_attempt
      : 0;
  const confirmSuccessRate =
    totals.confirm_attempt > 0
      ? totals.confirm_success / totals.confirm_attempt
      : 0;
  const prepareBlockRate =
    totals.prepare_attempt > 0
      ? totals.prepare_blocked / totals.prepare_attempt
      : 0;
  const confirmFailRate =
    totals.confirm_attempt > 0
      ? totals.confirm_failed / totals.confirm_attempt
      : 0;

  const daily: PaymentFunnelDailyPoint[] = dateAxis.map((date) => ({
    date,
    counts: dayMap.get(date) ?? emptyCounts(),
  }));

  const blockedReasons: PaymentFunnelBlockReason[] = Array.from(blockedReasonCount.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const failedReasons: PaymentFunnelBlockReason[] = Array.from(failedReasonCount.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const byPackage: PaymentFunnelByPackage[] = Array.from(packageStats.entries())
    .map(([packageId, s]) => ({
      packageId,
      prepareAttempt: s.prepareAttempt,
      confirmSuccess: s.confirmSuccess,
      conversionRate: s.prepareAttempt > 0 ? s.confirmSuccess / s.prepareAttempt : 0,
    }))
    .sort((a, b) => b.prepareAttempt - a.prepareAttempt);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    totals: {
      counts: totals,
      overallConversionRate,
      confirmSuccessRate,
      prepareBlockRate,
      confirmFailRate,
    },
    daily,
    blockedReasons,
    failedReasons,
    byPackage,
  };
}
