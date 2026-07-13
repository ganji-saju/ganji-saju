// 2026-07-07 — /admin/analytics 일별 롤업. raw(site_visits RPC · payment_orders ·
//   payment_funnel_events · admin_user_summary)에서 KST 하루치 지표를 계산해 metrics_daily
//   에 멱등 upsert. 순수 계산(computeDailyMetrics)과 I/O(runDailyMetricsRollup)를 분리 —
//   전자는 주입 raw 로 단위 테스트, 후자는 service 클라이언트로 조회+upsert.
//   설계: docs/superpowers/specs/2026-07-07-admin-analytics-daily-design.md
import type { SupabaseClient } from '@supabase/supabase-js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ISO 시각 → KST 날짜키(YYYY-MM-DD). operations-stats.toLocalDateKey 와 동일 산술. */
export function kstDateKey(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 날짜키(YYYY-MM-DD)를 deltaDays 만큼 이동. */
export function shiftDateKey(key: string, deltaDays: number): string {
  const base = new Date(`${key}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

/** [fromKey…toKey] 연속 날짜키 축(오름차순). */
export function dateAxis(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cur = fromKey;
  // 방어: 최대 366*5 일(무한루프 차단).
  for (let i = 0; i < 366 * 5 && cur <= toKey; i += 1) {
    out.push(cur);
    cur = shiftDateKey(cur, 1);
  }
  return out;
}

/** 최근 n일(오늘 포함) KST 날짜키. 크론용. */
export function recentKstDateKeys(n: number, now: Date = new Date()): string[] {
  const todayKey = kstDateKey(now.toISOString());
  const from = shiftDateKey(todayKey, -(Math.max(1, n) - 1));
  return dateAxis(from, todayKey);
}

/** KST 자정 → UTC ISO (조회 경계용). */
export function kstMidnightIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+09:00`).toISOString();
}

export interface InflowReferrer {
  host: string;
  visitors: number;
}
export interface InflowUtm {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
}

export interface MetricsDailyRow {
  date_key: string;
  visitors: number;
  page_views: number;
  new_signups: number;
  paid_orders: number;
  revenue_won: number;
  /** 환불 발생일(refunded_at) 기준 환불 건수·금액. 매출과 분리 — net = revenue − refunded. */
  refunded_orders: number;
  refunded_won: number;
  prepare_attempts: number;
  checkout_starts: number;
  confirm_success: number;
  inflow_referrers: InflowReferrer[];
  inflow_utm: InflowUtm[];
}

/** metrics_daily_source RPC 한 행(일별 방문/유입). */
export interface SourceRow {
  date_key: string;
  visitors: number | string;
  page_views: number | string;
  inflow_referrers: unknown;
  inflow_utm: unknown;
}

/** payment_orders 완료 건(귀속 시각 = confirmed_at ?? fulfilled_at ?? created_at). */
export interface PaymentRow {
  amount: number | null;
  confirmed_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

export interface FunnelRow {
  stage: string;
  created_at: string;
}

export interface RefundRow {
  amount: number | null;
  refunded_at: string | null;
}

export interface ComputeDailyMetricsInput {
  /** 계산 대상 KST 날짜키(각각 1행 생성). */
  dateKeys: string[];
  sourceRows: SourceRow[];
  /** 완료 결제 건(윈도우로 사전 필터됨). */
  paymentRows: PaymentRow[];
  /** 환불(status='refunded') 건. refunded_at 기준 귀속. 없으면 refunded_won=0. */
  refundRows?: RefundRow[];
  /** 가입 시각 ISO 목록(admin_user_summary.signup_at). */
  signupIsos: string[];
  funnelRows: FunnelRow[];
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? Number(n) : 0;
}

function toReferrers(v: unknown): InflowReferrer[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      const o = (e ?? {}) as Record<string, unknown>;
      return { host: String(o.host ?? ''), visitors: num(o.visitors as number) };
    })
    .filter((e) => e.host);
}

function toUtm(v: unknown): InflowUtm[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      const o = (e ?? {}) as Record<string, unknown>;
      return {
        source: String(o.source ?? ''),
        medium: String(o.medium ?? ''),
        campaign: String(o.campaign ?? ''),
        visitors: num(o.visitors as number),
      };
    })
    .filter((e) => e.source);
}

/** 귀속 결제 시각(confirmed → fulfilled → created 순). */
export function paymentAttributionIso(row: PaymentRow): string {
  return row.confirmed_at ?? row.fulfilled_at ?? row.created_at;
}

/** 순수 계산: 주입된 raw → 날짜별 metrics_daily 행. I/O 없음(테스트 가능). */
export function computeDailyMetrics(input: ComputeDailyMetricsInput): MetricsDailyRow[] {
  const keySet = new Set(input.dateKeys);
  const rows = new Map<string, MetricsDailyRow>();
  for (const dk of input.dateKeys) {
    rows.set(dk, {
      date_key: dk,
      visitors: 0,
      page_views: 0,
      new_signups: 0,
      paid_orders: 0,
      revenue_won: 0,
      refunded_orders: 0,
      refunded_won: 0,
      prepare_attempts: 0,
      checkout_starts: 0,
      confirm_success: 0,
      inflow_referrers: [],
      inflow_utm: [],
    });
  }

  for (const s of input.sourceRows) {
    const r = rows.get(s.date_key);
    if (!r) continue;
    r.visitors = num(s.visitors);
    r.page_views = num(s.page_views);
    r.inflow_referrers = toReferrers(s.inflow_referrers);
    r.inflow_utm = toUtm(s.inflow_utm);
  }

  for (const iso of input.signupIsos) {
    const r = rows.get(kstDateKey(iso));
    if (r) r.new_signups += 1;
  }

  for (const p of input.paymentRows) {
    const dk = kstDateKey(paymentAttributionIso(p));
    if (!keySet.has(dk)) continue;
    const r = rows.get(dk)!;
    r.paid_orders += 1;
    r.revenue_won += Math.max(0, num(p.amount));
  }

  // 환불은 발생일(refunded_at)에 별도 집계. 매출(revenue_won)은 판 날 그대로 두고,
  //   net = revenue − refunded 는 조회 시점에 계산한다(총매출·환불액을 둘 다 보존).
  for (const rf of input.refundRows ?? []) {
    if (!rf.refunded_at) continue;
    const dk = kstDateKey(rf.refunded_at);
    if (!keySet.has(dk)) continue;
    const r = rows.get(dk)!;
    r.refunded_orders += 1;
    r.refunded_won += Math.max(0, num(rf.amount));
  }

  for (const f of input.funnelRows) {
    const r = rows.get(kstDateKey(f.created_at));
    if (!r) continue;
    if (f.stage === 'prepare_attempt') r.prepare_attempts += 1;
    else if (f.stage === 'confirm_attempt') r.checkout_starts += 1;
    else if (f.stage === 'confirm_success') r.confirm_success += 1;
  }

  return input.dateKeys.map((dk) => rows.get(dk)!);
}

// ---- I/O 오케스트레이션 ----

const COMPLETED_ORDER_STATUSES = ['confirmed', 'fulfilling', 'fulfilled'];
const PAGE_SIZE = 1000;
const MAX_PAGES = 200; // 백필(전체 기간) 대비 넉넉히.

async function fetchAllPages<T>(
  label: string,
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} query failed: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) {
      // 조용한 절단(=지표 과소집계)을 막기 위해 loud fail — 백필 구간을 좁혀 재시도.
      throw new Error(
        `${label} exceeded ${MAX_PAGES * PAGE_SIZE} rows — narrow the backfill window and retry`
      );
    }
  }
  return out;
}

export interface RollupResult {
  upserted: number;
  fromKey: string;
  toKey: string;
}

/** 지정 KST 날짜 구간을 raw 에서 재집계해 metrics_daily 에 멱등 upsert. */
export async function runDailyMetricsRollup(
  service: SupabaseClient,
  opts: { dateKeys: string[]; now?: Date }
): Promise<RollupResult> {
  const dateKeys = [...opts.dateKeys].sort();
  if (dateKeys.length === 0) return { upserted: 0, fromKey: '', toKey: '' };
  const fromKey = dateKeys[0]!;
  const toKey = dateKeys[dateKeys.length - 1]!;
  const nowIso = (opts.now ?? new Date()).toISOString();

  const windowStartIso = kstMidnightIso(fromKey);
  const windowEndIso = kstMidnightIso(shiftDateKey(toKey, 1)); // 배타적 상한.

  const { data: sourceData, error: sourceErr } = await service.rpc('metrics_daily_source', {
    from_key: fromKey,
    to_key: toKey,
  });
  if (sourceErr) throw new Error(`metrics_daily_source RPC failed: ${sourceErr.message}`);
  const sourceRows = (sourceData ?? []) as SourceRow[];

  const signupRows = await fetchAllPages<{ signup_at: string }>('signups', (from, to) =>
    service
      .from('admin_user_summary')
      .select('signup_at')
      .gte('signup_at', windowStartIso)
      .lt('signup_at', windowEndIso)
      .order('signup_at', { ascending: true })
      .range(from, to)
  );

  // 귀속 시각(confirmed_at ?? fulfilled_at ?? created_at) 이 윈도우에 드는 완료 결제를 전부
  //   포함해야 함 — created_at 하나로만 하한을 잡으면 지연확정(계좌이체·가상계좌: 생성보다
  //   며칠 뒤 확정) 결제가 누락된다. 세 시각 중 하나라도 windowStart 이상이면 fetch(하한 OR),
  //   created_at 은 귀속시각보다 항상 앞서므로 windowEnd 를 상한으로 유지(fetch 크기 bound).
  const paymentRows = await fetchAllPages<PaymentRow>('payments', (from, to) =>
    service
      .from('payment_orders')
      .select('amount, confirmed_at, fulfilled_at, created_at')
      .in('status', COMPLETED_ORDER_STATUSES)
      .or(
        `confirmed_at.gte.${windowStartIso},fulfilled_at.gte.${windowStartIso},created_at.gte.${windowStartIso}`
      )
      .lt('created_at', windowEndIso)
      .order('created_at', { ascending: true })
      .range(from, to)
  );

  const funnelRows = await fetchAllPages<FunnelRow>('funnel', (from, to) =>
    service
      .from('payment_funnel_events')
      .select('stage, created_at')
      .gte('created_at', windowStartIso)
      .lt('created_at', windowEndIso)
      .order('created_at', { ascending: true })
      .range(from, to)
  );

  // 환불은 발생일(refunded_at) 기준으로 별도 집계 — 판 날 매출은 그대로 두고 환불한 날에 계상.
  const refundRows = await fetchAllPages<RefundRow>('refunds', (from, to) =>
    service
      .from('payment_orders')
      .select('amount, refunded_at')
      .eq('status', 'refunded')
      .gte('refunded_at', windowStartIso)
      .lt('refunded_at', windowEndIso)
      .order('refunded_at', { ascending: true })
      .range(from, to)
  );

  const rows = computeDailyMetrics({
    dateKeys,
    sourceRows,
    signupIsos: signupRows.map((r) => r.signup_at).filter(Boolean),
    paymentRows,
    refundRows,
    funnelRows,
  });

  const dbRows = rows.map((r) => ({ ...r, refreshed_at: nowIso }));
  const { error: upsertErr } = await service
    .from('metrics_daily')
    .upsert(dbRows, { onConflict: 'date_key' });
  if (upsertErr) throw new Error(`metrics_daily upsert failed: ${upsertErr.message}`);

  return { upserted: dbRows.length, fromKey, toKey };
}
