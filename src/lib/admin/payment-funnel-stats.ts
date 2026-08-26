// 2026-05-16 PR (B1) — payment_funnel_events 일별 funnel 집계.
// /admin/payment-funnel 페이지의 단일 데이터 source.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentFunnelStage } from '@/lib/payments/funnel-log';
import { ADMIN_RANGE_MAX_DAYS } from './metric-ranges';

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
  /** prepare_attempt → confirm_success 전환율 (0~1). 분모(prepare_attempt) 0 이면 null. */
  overallConversionRate: number | null;
  /** confirm_attempt → confirm_success 결제 시도 성공률 (0~1). 분모 0 이면 null. */
  confirmSuccessRate: number | null;
  /** prepare_attempt → prepare_blocked 비율 (이미 구매·미로그인 등 차단). 분모 0 이면 null. */
  prepareBlockRate: number | null;
  /** confirm_attempt → confirm_failed 실패율. 분모 0 이면 null. */
  confirmFailRate: number | null;
}

export interface PaymentFunnelBlockReason {
  reason: string;
  count: number;
}

export interface PaymentFunnelByPackage {
  packageId: string;
  prepareAttempt: number;
  confirmSuccess: number;
  conversionRate: number | null;
}

/** 2026-08-26 — 사이트 **안** 진입점(metadata.from). 어느 화면에서 결제창으로 왔나. */
export interface PaymentFunnelByEntry {
  entry: string;
  prepareAttempt: number;
  confirmSuccess: number;
  conversionRate: number | null;
}

/** 2026-08-26 — 어떤 화면의 페이월을 봤나(paywall_viewed.metadata.surface). */
export interface PaymentFunnelSurfaceView {
  surface: string;
  views: number;
}

/** 2026-08-26 — 결제자의 사이트 **밖** 유입 채널(site_visits 를 user_id 로 조인). */
export interface PaymentFunnelByChannel {
  channel: string;
  payers: number;
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
  /** 사이트 안 진입점 별 전환 (prepareAttempt desc). */
  byEntry: PaymentFunnelByEntry[];
  /** 페이월 노출 화면 별 (views desc). */
  paywallSurfaces: PaymentFunnelSurfaceView[];
  /** 결제자 유입 채널 (payers desc). site_visits 조인 실패/미매칭이면 빈 배열. */
  payerChannels: PaymentFunnelByChannel[];
  /** 채널을 찾아낸 결제자 수 / 전체 결제자 수 — 커버리지를 숨기지 않는다. */
  payerChannelCoverage: { matched: number; total: number };
}

interface FunnelRow {
  stage: PaymentFunnelStage | 'paywall_viewed';
  package_id: string | null;
  reason: string | null;
  created_at: string;
  order_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
}

function readMetaString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
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

// 분모가 0 이면 전환율은 정의되지 않음 → null. 0 으로 강등하면 시도 없는 구간이
// '전환 0%' 처럼 보여 판단을 흐린다(analytics-metrics.ts 의 rate() 와 동일 계약).
function rate(numer: number, denom: number): number | null {
  return denom > 0 ? numer / denom : null;
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

/**
 * 2026-08-26 — 진입점 보강. `payment_orders.entry_source` 는 prepare 가 주문을 만들 때
 * 항상 남기므로(prepare/route.ts `entrySource: from`), confirm 계열 이벤트가 metadata 에
 * from 을 안 실어도 order_id 로 되찾을 수 있다. 과거 행까지 같이 살아난다.
 */
async function resolveOrderEntrySources(
  supabase: SupabaseClient,
  orderIds: readonly string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(orderIds));
  if (unique.length === 0) return map;

  // .in() 은 URL 길이 제약이 있어 청크로 나눈다.
  const CHUNK = 200;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('payment_orders')
      .select('order_id, entry_source')
      .in('order_id', chunk);

    if (error) {
      console.error('[funnel-stats] payment_orders entry_source lookup failed:', error.message);
      return map;
    }
    for (const row of (data ?? []) as Array<{ order_id: string | null; entry_source: string | null }>) {
      if (row.order_id && row.entry_source) map.set(row.order_id, row.entry_source);
    }
  }
  return map;
}

/**
 * 2026-08-26 — 결제자의 **사이트 밖** 유입 채널. payment_funnel_events 에는 utm 이 없고
 * site_visits 에만 있어서, 결제는 항상 로그인이 필요하다는 점을 이용해 `user_id` 로 잇는다.
 * 채널은 사용자별 **가장 이른 방문 행** 기준(utm_source > referrer_host > '직접 유입').
 *
 * ⚠️ 한계: 첫 유입이 비로그인이면 그 행의 user_id 는 null 이라 이 조인에 안 잡힌다.
 *   그래서 커버리지(matched/total)를 같이 돌려주고 화면에 그대로 적는다 — 분모를 숨기면
 *   "채널 상위 3개"가 전체처럼 보인다.
 */
async function resolvePayerChannels(
  supabase: SupabaseClient,
  payerIds: ReadonlySet<string>
): Promise<{ payerChannels: PaymentFunnelByChannel[]; matchedPayers: number }> {
  if (payerIds.size === 0) return { payerChannels: [], matchedPayers: 0 };
  // .in() 은 URL 길이 제약이 있어 상한을 둔다(결제자 수가 이 규모면 별도 집계가 맞다).
  const ids = Array.from(payerIds).slice(0, 500);

  const { data, error } = await supabase
    .from('site_visits')
    .select('user_id, date_key, utm_source, referrer_host')
    .in('user_id', ids)
    .order('date_key', { ascending: true });

  if (error) {
    console.error('[funnel-stats] site_visits join failed:', error.message);
    return { payerChannels: [], matchedPayers: 0 };
  }

  const firstByUser = new Map<string, string>();
  for (const row of (data ?? []) as Array<{
    user_id: string | null;
    utm_source: string | null;
    referrer_host: string | null;
  }>) {
    if (!row.user_id || firstByUser.has(row.user_id)) continue; // date_key asc → 첫 행이 최초 방문
    firstByUser.set(row.user_id, row.utm_source || row.referrer_host || '직접 유입');
  }

  const channelCount = new Map<string, number>();
  for (const channel of firstByUser.values()) {
    channelCount.set(channel, (channelCount.get(channel) ?? 0) + 1);
  }

  return {
    payerChannels: Array.from(channelCount.entries())
      .map(([channel, payers]) => ({ channel, payers }))
      .sort((a, b) => b.payers - a.payers),
    matchedPayers: firstByUser.size,
  };
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export async function buildPaymentFunnelSnapshot(
  supabase: SupabaseClient,
  options: { windowDays?: number } = {}
): Promise<PaymentFunnelSnapshot> {
  // 2026-08-26 — 상한 120 이 프리셋 180·365 를 조용히 잘라내고 있었다(화면은 '1년',
  //   데이터는 120일). 프리셋 최대값과 같은 상한을 쓴다.
  const windowDays = Math.max(1, Math.min(ADMIN_RANGE_MAX_DAYS, options.windowDays ?? 30));

  // 2026-07-04 감사 — 윈도우 시작을 날짜축 첫날의 KST 자정으로 스냅.
  //   기존엔 '지금-24h×N'(UTC 롤링)이라 축 밖 행이 totals 에만 섞여 totals≠Σdaily.
  const dateAxis = buildDateAxis(windowDays);
  const sinceIso = new Date(Date.parse(`${dateAxis[0]}T00:00:00+09:00`)).toISOString();

  // 2026-07-04 감사 — PostgREST 기본 1000행 캡으로 최신 데이터가 조용히 잘리던 문제
  //   → range 페이지네이션으로 전량 수집(퍼널은 시도당 2~3행이라 윈도우에서 쉽게 초과).
  const rows: FunnelRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('payment_funnel_events')
      .select('stage, package_id, reason, created_at, order_id, user_id, metadata')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`payment_funnel_events query failed: ${error.message}`);
    }
    const pageRows = (data ?? []) as FunnelRow[];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) {
      console.error(`[funnel-stats] exceeded ${MAX_PAGES * PAGE_SIZE} rows — truncated`);
    }
  }

  // 일별 buckets — date 축은 항상 windowDays 만큼 (빈 날짜도 0 포함).
  const dayMap = new Map<string, Record<PaymentFunnelStage, number>>();
  for (const d of dateAxis) dayMap.set(d, emptyCounts());

  const totals = emptyCounts();
  const blockedReasonCount = new Map<string, number>();
  const failedReasonCount = new Map<string, number>();
  const packageStats = new Map<string, { prepareAttempt: number; confirmSuccess: number }>();
  const entryStats = new Map<string, { prepareAttempt: number; confirmSuccess: number }>();
  const pendingEntries: Array<{
    stage: 'prepare_attempt' | 'confirm_success';
    from: string | null;
    orderId: string | null;
  }> = [];
  const surfaceCount = new Map<string, number>();
  const payerIds = new Set<string>();

  for (const row of rows) {
    const stage = row.stage;
    // 2026-08-26 — paywall_viewed 는 STAGES 밖(퍼널 분모 전용 stage)이라 아래 guard 에서
    //   잘려나갔다. totals 를 건드리지 않도록 guard **앞**에서 surface 만 집계한다.
    if (stage === 'paywall_viewed') {
      const surface = readMetaString(row.metadata, 'surface');
      if (surface) surfaceCount.set(surface, (surfaceCount.get(surface) ?? 0) + 1);
      continue;
    }
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
    if (stage === 'prepare_attempt' || stage === 'confirm_success') {
      // 2026-08-26 — confirm_success 를 쓰는 3경로(confirm route·nicepay return·reconciliation)가
      //   모두 metadata 에 from 을 안 싣는다. 게다가 reconciliation 은 **예전 결제**를 지금
      //   confirm_success 로 기록해서, 짝이 되는 prepare 가 윈도우 밖이면 그 결제는 통째로
      //   진입점 미상이 된다(=진입점 카드가 '(미지정)' 하나로만 채워지던 원인).
      //   그래서 여기서 즉시 세지 않고, 아래 2패스에서 payment_orders.entry_source 로 보강한다.
      pendingEntries.push({
        stage,
        from: readMetaString(row.metadata, 'from'),
        orderId: row.order_id,
      });
    }
    if (stage === 'confirm_success' && row.user_id) payerIds.add(row.user_id);
  }

  const overallConversionRate = rate(totals.confirm_success, totals.prepare_attempt);
  const confirmSuccessRate = rate(totals.confirm_success, totals.confirm_attempt);
  const prepareBlockRate = rate(totals.prepare_blocked, totals.prepare_attempt);
  const confirmFailRate = rate(totals.confirm_failed, totals.confirm_attempt);

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
      conversionRate: rate(s.confirmSuccess, s.prepareAttempt),
    }))
    .sort((a, b) => b.prepareAttempt - a.prepareAttempt);

  const orderEntrySources = await resolveOrderEntrySources(
    supabase,
    pendingEntries.filter((e) => !e.from && e.orderId).map((e) => e.orderId as string)
  );
  for (const pending of pendingEntries) {
    // from 도 entry_source 도 없으면 '(미지정)' 으로 모은다 — 버리면 합이 안 맞아 표를 못 믿는다.
    const entry =
      pending.from ?? (pending.orderId ? orderEntrySources.get(pending.orderId) : null) ?? '(미지정)';
    const slot = entryStats.get(entry) ?? { prepareAttempt: 0, confirmSuccess: 0 };
    if (pending.stage === 'prepare_attempt') slot.prepareAttempt += 1;
    if (pending.stage === 'confirm_success') slot.confirmSuccess += 1;
    entryStats.set(entry, slot);
  }

  const byEntry: PaymentFunnelByEntry[] = Array.from(entryStats.entries())
    .map(([entry, s]) => ({
      entry,
      prepareAttempt: s.prepareAttempt,
      confirmSuccess: s.confirmSuccess,
      conversionRate: rate(s.confirmSuccess, s.prepareAttempt),
    }))
    .sort((a, b) => b.prepareAttempt - a.prepareAttempt);

  const paywallSurfaces: PaymentFunnelSurfaceView[] = Array.from(surfaceCount.entries())
    .map(([surface, views]) => ({ surface, views }))
    .sort((a, b) => b.views - a.views);

  const { payerChannels, matchedPayers } = await resolvePayerChannels(supabase, payerIds);

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
    byEntry,
    paywallSurfaces,
    payerChannels,
    payerChannelCoverage: { matched: matchedPayers, total: payerIds.size },
  };
}
