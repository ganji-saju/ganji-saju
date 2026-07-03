// 2026-05-25 Phase 1 — 어드민 사용자 상세 + 검색 데이터 레이어.
//   /admin/users, /admin/users/[id] 가 사용. service_role 로 own-row RLS 우회.
//   순수 로직(팔자 추출·LLM 통계·환불 가능 판정)은 단위 테스트로 고정.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  buildPaymentHistory,
  isCashCreditTransaction,
  resolveProductEntitlementName,
  type CreditTransactionHistoryRow,
  type PaymentHistoryResult,
  type PaymentOrderHistoryRow,
  type ProductEntitlementHistoryRow,
} from '@/lib/billing/payment-history';
import {
  determineCreditRefundEligibility,
  type CreditRefundEligibleItem,
  type CreditRefundEligibility,
  type CreditRefundLotRow,
} from '@/lib/admin/credit-refunds';
import { hashUserId } from '@/server/ai/llm-telemetry';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';

// ── 순수 로직 ──────────────────────────────────────────────

export interface PaljaResult {
  year: string;
  month: string;
  day: string;
  hour: string | null;
  /** 4기둥 ganzi 연결 (시주 있으면 8글자, 없으면 6글자). */
  eightChar: string;
}

interface PillarsCarrier {
  pillars: {
    year: { ganzi: string };
    month: { ganzi: string };
    day: { ganzi: string };
    hour?: { ganzi: string } | null;
  };
}

/** 사주 데이터 → 팔자(4기둥 ganzi). 시주 미입력이면 hour=null·6글자. */
export function extractPalja(sajuData: PillarsCarrier): PaljaResult {
  const p = sajuData.pillars;
  const year = p.year.ganzi;
  const month = p.month.ganzi;
  const day = p.day.ganzi;
  const hour = p.hour?.ganzi ?? null;
  return { year, month, day, hour, eightChar: [year, month, day, hour ?? ''].join('') };
}

export interface LlmFeatureStat {
  feature: string;
  openai: number;
  cache: number;
  fallback: number;
  costUsd: number;
}

/** ai_llm_runs 행(특정 사용자) → feature별 source 카운트 + 비용 합. */
export function buildUserLlmStats(
  rows: ReadonlyArray<{ feature: string; source: string; cost_usd: number | null }>
): LlmFeatureStat[] {
  const map = new Map<string, LlmFeatureStat>();
  for (const row of rows) {
    let stat = map.get(row.feature);
    if (!stat) {
      stat = { feature: row.feature, openai: 0, cache: 0, fallback: 0, costUsd: 0 };
      map.set(row.feature, stat);
    }
    if (row.source === 'openai') stat.openai += 1;
    else if (row.source === 'cache') stat.cache += 1;
    else if (row.source === 'fallback') stat.fallback += 1;
    stat.costUsd += row.cost_usd ?? 0;
  }
  for (const stat of map.values()) {
    stat.costUsd = Math.round(stat.costUsd * 1_000_000) / 1_000_000;
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd || a.feature.localeCompare(b.feature));
}

export interface RefundEligibleItem {
  id: string;
  productName: string;
  amountWon: number;
  hasPaymentKey: boolean;
  paymentKey: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface RefundEligibility {
  items: RefundEligibleItem[];
  creditItems: CreditRefundEligibleItem[];
  totalProductRefundableWon: number;
  totalCreditRefundableWon: number;
  totalRefundableWon: number;
}

/**
 * 환불 가능 여부(상태 표시만 — 실제 Toss cancel 은 Phase 2).
 * 활성 product_entitlements 중 amount>0(현금 결제분)을 환불 대상으로 본다.
 * hasPaymentKey=true 여야 Phase 2 Toss cancel 가능.
 */
export function determineRefundEligibility(
  entitlements: ReadonlyArray<ProductEntitlementHistoryRow>,
  creditEligibility: CreditRefundEligibility = {
    items: [],
    refundableItems: [],
    totalRefundableWon: 0,
  }
): RefundEligibility {
  const items: RefundEligibleItem[] = entitlements
    .filter((e) => typeof e.amount === 'number' && e.amount > 0)
    .map((e) => ({
      id: e.id,
      productName: resolveProductEntitlementName(e.product_id),
      amountWon: e.amount as number,
      hasPaymentKey: Boolean(e.payment_key),
      paymentKey: e.payment_key,
      orderId: e.order_id,
      createdAt: e.created_at,
    }));
  const totalProductRefundableWon = items.reduce((sum, i) => sum + i.amountWon, 0);
  const totalCreditRefundableWon = creditEligibility.totalRefundableWon;
  return {
    items,
    creditItems: creditEligibility.items,
    totalProductRefundableWon,
    totalCreditRefundableWon,
    totalRefundableWon: totalProductRefundableWon + totalCreditRefundableWon,
  };
}

// ── 데이터 레이어 (service_role, RLS 우회) ──────────────────

export interface AdminUserProfile {
  displayName: string | null;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthHour: number | null;
  gender: string | null;
}

export interface AdminUserSearchResult {
  id: string;
  email: string | null;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  email: string | null;
  createdAt: string;
  profile: AdminUserProfile | null;
  palja: PaljaResult | null;
  latestReadingAt: string | null;
  readingCount: number;
  payment: PaymentHistoryResult;
  dialogueCount: number;
  llmStats: LlmFeatureStat[];
  refund: RefundEligibility;
  refundRequests: AdminRefundRequest[];
}

export interface AdminRefundRequest {
  id: string;
  refundKind: string;
  productId: string;
  paymentKey: string | null;
  amount: number | null;
  originalAmount: number | null;
  creditAmount: number | null;
  reason: string;
  status: string;
  errorMessage: string | null;
  tossResponse: unknown;
  /** 표기용 PG. 'unknown' = payment_key 가 주문과 매칭 안 됨(수동 처리·구버전) —
   *  실행 시점 분기는 refund route 가 getOrderProviderByPaymentKey 로 별도 판정. */
  provider: 'toss' | 'nicepay' | 'unknown';
  createdAt: string;
  updatedAt: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 이메일(부분) 또는 UUID 로 사용자 검색. profiles 에 email 이 없어 auth.admin 사용. */
export async function searchAdminUsers(query: string): Promise<AdminUserSearchResult[]> {
  const q = query.trim();
  if (!q || !hasSupabaseServiceEnv) return [];
  const supabase = await createServiceClient();
  if (UUID_RE.test(q)) {
    const { data, error } = await supabase.auth.admin.getUserById(q);
    if (error || !data.user) return [];
    return [{ id: data.user.id, email: data.user.email ?? null, createdAt: data.user.created_at }];
  }
  // 이메일 부분 일치: listUsers(첫 페이지 200) 후 client 필터. 대규모 시 개선 대상.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return [];
  const lower = q.toLowerCase();
  return data.users
    .filter((u) => (u.email ?? '').toLowerCase().includes(lower))
    .slice(0, 50)
    .map((u) => ({ id: u.id, email: u.email ?? null, createdAt: u.created_at }));
}

function resolvePaljaFromReading(row: {
  result_json: unknown;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_hour: number | null;
  gender: string | null;
}): PaljaResult | null {
  const pillars = (row.result_json as { pillars?: PillarsCarrier['pillars'] } | null)?.pillars;
  if (pillars?.year?.ganzi && pillars?.month?.ganzi && pillars?.day?.ganzi) {
    return extractPalja({ pillars });
  }
  // fallback: 저장본에서 못 읽으면 birth_* 로 재계산.
  if (
    row.birth_year &&
    row.birth_month &&
    row.birth_day &&
    (row.gender === 'male' || row.gender === 'female')
  ) {
    try {
      const data = calculateSajuDataV1({
        year: row.birth_year,
        month: row.birth_month,
        day: row.birth_day,
        hour: row.birth_hour ?? undefined,
        gender: row.gender,
      });
      return extractPalja(data);
    } catch {
      return null;
    }
  }
  return null;
}

/** 사용자 상세 — 6섹션 집계. service_role 로 own-row RLS 우회. 없으면 null. */
export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  if (!hasSupabaseServiceEnv) return null;
  const supabase = await createServiceClient();

  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authData.user) return null;
  const user = authData.user;

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('display_name, birth_year, birth_month, birth_day, birth_hour, gender')
    .eq('user_id', userId)
    .maybeSingle();
  const profile: AdminUserProfile | null = profileRow
    ? {
        displayName: profileRow.display_name ?? null,
        birthYear: profileRow.birth_year ?? null,
        birthMonth: profileRow.birth_month ?? null,
        birthDay: profileRow.birth_day ?? null,
        birthHour: profileRow.birth_hour ?? null,
        gender: profileRow.gender ?? null,
      }
    : null;

  const { data: readingRow } = await supabase
    .from('readings')
    .select('result_json, birth_year, birth_month, birth_day, birth_hour, gender, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const palja = readingRow ? resolvePaljaFromReading(readingRow) : null;
  const latestReadingAt = (readingRow?.created_at as string | undefined) ?? null;
  const { count: readingCount } = await supabase
    .from('readings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: entitlementRows } = await supabase
    .from('product_entitlements')
    .select('id, product_id, amount, order_id, payment_key, package_id, created_at, metadata')
    .eq('user_id', userId);
  // 2026-07-04 감사 — type 무필터 전량 fetch 는 사용(use) 행까지 포함해 1000행 캡에서
  // 결제 행이 잘릴 수 있음 → 서버측 type 필터 + 정렬(이력·환불판정 모두 purchase/subscription 만 검사).
  const { data: creditRows } = await supabase
    .from('credit_transactions')
    .select('id, type, amount, metadata, created_at, feature')
    .eq('user_id', userId)
    .in('type', ['purchase', 'subscription'])
    .order('created_at', { ascending: false });
  const { data: creditLotRows } = await supabase
    .from('credit_lots')
    .select('id, user_id, amount_remaining, amount_initial, expires_at, source, metadata, created_at')
    .eq('user_id', userId)
    .eq('source', 'purchase');
  // 코인 sunset 이후 멤버십 결제는 credit_transactions 에 없음 → 완료 주문 원장 보강(orderId dedupe).
  const { data: orderHistoryRows } = await supabase
    .from('payment_orders')
    .select('id, order_id, package_id, amount, status, created_at')
    .eq('user_id', userId)
    .in('status', ['confirmed', 'fulfilling', 'fulfilled']);
  const productEntitlements = (entitlementRows ?? []) as unknown as ProductEntitlementHistoryRow[];
  const allCreditTransactions = (creditRows ?? []) as unknown as Array<
    CreditTransactionHistoryRow & { type: string; feature?: string | null }
  >;
  const creditTransactions = allCreditTransactions.filter((r) => isCashCreditTransaction(r));
  const payment = buildPaymentHistory({
    productEntitlements,
    creditTransactions,
    paymentOrders: (orderHistoryRows ?? []) as unknown as PaymentOrderHistoryRow[],
  });

  const { count: dialogueCount } = await supabase
    .from('dialogue_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const hash = hashUserId(userId);
  let llmStats: LlmFeatureStat[] = [];
  if (hash) {
    // 2026-07-04 감사 — 헤비유저는 1000행 캡으로 LLM 사용/비용 과소집계 → 페이지네이션.
    const llmRows: Array<{ feature: string; source: string; cost_usd: number | null }> = [];
    for (let pageIdx = 0; pageIdx < 20; pageIdx += 1) {
      const from = pageIdx * 1000;
      const { data: llmPage } = await supabase
        .from('ai_llm_runs')
        .select('feature, source, cost_usd')
        .eq('user_id_hash', hash)
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      const rows = (llmPage ?? []) as unknown as Array<{
        feature: string;
        source: string;
        cost_usd: number | null;
      }>;
      llmRows.push(...rows);
      if (rows.length < 1000) break;
    }
    llmStats = buildUserLlmStats(llmRows);
  }

  const creditRefundEligibility = determineCreditRefundEligibility(
    allCreditTransactions,
    (creditLotRows ?? []) as unknown as CreditRefundLotRow[]
  );
  const refund = determineRefundEligibility(productEntitlements, creditRefundEligibility);

  const { data: refundRows } = await supabase
    .from('refund_requests')
    .select(
      'id, refund_kind, product_id, payment_key, amount, original_amount, credit_amount, reason, status, error_message, toss_response, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  // 2026-06-27 — 환불 표기용 PG. payment_key → order metadata.provider (배치 1쿼리, N+1 회피).
  const refundPaymentKeys = Array.from(
    new Set(
      ((refundRows ?? []) as Array<{ payment_key: string | null }>)
        .map((r) => r.payment_key)
        .filter((k): k is string => Boolean(k))
    )
  );
  const { data: refundOrderRows } = refundPaymentKeys.length
    ? await supabase
        .from('payment_orders')
        .select('payment_key, metadata')
        .in('payment_key', refundPaymentKeys)
    : { data: [] as Array<{ payment_key: string; metadata: unknown }> };
  const refundProviderByKey = new Map<string, 'toss' | 'nicepay'>(
    ((refundOrderRows ?? []) as Array<{ payment_key: string; metadata: unknown }>).map((o) => {
      const meta = (o.metadata ?? null) as Record<string, unknown> | null;
      return [o.payment_key, meta?.provider === 'nicepay' ? 'nicepay' : 'toss'] as const;
    })
  );

  const refundRequests: AdminRefundRequest[] = (
    (refundRows ?? []) as unknown as Array<{
      id: string;
      refund_kind: string | null;
      product_id: string;
      payment_key: string | null;
      amount: number | null;
      original_amount: number | null;
      credit_amount: number | null;
      reason: string;
      status: string;
      error_message: string | null;
      toss_response: unknown;
      created_at: string;
      updated_at: string | null;
    }>
  ).map((r) => ({
    id: r.id,
    refundKind: r.refund_kind ?? 'product',
    productId: r.product_id,
    paymentKey: r.payment_key,
    amount: r.amount,
    originalAmount: r.original_amount,
    creditAmount: r.credit_amount,
    reason: r.reason,
    status: r.status,
    errorMessage: r.error_message,
    tossResponse: r.toss_response,
    // 2026-07-04 — 매칭 실패 시 'toss' 단정 대신 'unknown'(나이스페이 전환 후 오표기 방지).
    provider: r.payment_key ? (refundProviderByKey.get(r.payment_key) ?? 'unknown') : 'unknown',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at,
    profile,
    palja,
    latestReadingAt,
    readingCount: readingCount ?? 0,
    payment,
    dialogueCount: dialogueCount ?? 0,
    llmStats,
    refund,
    refundRequests,
  };
}
