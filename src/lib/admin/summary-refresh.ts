// src/lib/admin/summary-refresh.ts
// admin_user_summary 매시간 배치 갱신. service_role. 상세와 동일 로직 재사용.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  buildPaymentHistory,
  isCashCreditTransaction,
  type CreditTransactionHistoryRow,
  type PaymentOrderHistoryRow,
  type ProductEntitlementHistoryRow,
} from '@/lib/billing/payment-history';
import {
  determineCreditRefundEligibility,
  type CreditRefundLotRow,
  type CreditRefundTransactionRow,
} from '@/lib/admin/credit-refunds';
import { determineRefundEligibility } from '@/lib/admin/user-detail';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

interface SummaryUpsert {
  user_id: string;
  email: string | null;
  display_name: string | null;
  signup_at: string;
  signup_provider: string | null;
  profile_complete: boolean;
  last_active_at: string;
  ltv_won: number;
  paid_count: number;
  credit_balance: number;
  credit_expiring: number;
  subscription_status: string | null;
  refundable_won: number;
  reading_count: number;
  chat_count: number;
  refreshed_at: string;
}

function maxIso(...values: Array<string | null | undefined>): string | null {
  const ts = values.filter((v): v is string => Boolean(v)).map((v) => new Date(v).getTime());
  if (ts.length === 0) return null;
  return new Date(Math.max(...ts)).toISOString();
}

async function computeUserSummary(
  service: ServiceClient,
  user: {
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at?: string | null;
    app_metadata?: Record<string, unknown>;
  },
  nowIso: string
): Promise<SummaryUpsert> {
  const userId = user.id;

  const { data: profile } = await service
    .from('profiles')
    .select('display_name, birth_year, gender')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: entRows } = await service
    .from('product_entitlements')
    .select('id, product_id, amount, order_id, payment_key, package_id, created_at, metadata')
    .eq('user_id', userId);
  const productEntitlements = (entRows ?? []) as unknown as ProductEntitlementHistoryRow[];

  const { data: creditRows } = await service
    .from('credit_transactions')
    .select('id, type, amount, metadata, created_at, feature')
    .eq('user_id', userId);
  const allCredit = (creditRows ?? []) as unknown as Array<
    CreditTransactionHistoryRow & { type: string; feature?: string | null }
  >;
  const cashCredit = allCredit.filter((r) => isCashCreditTransaction(r));

  // 2026-07-04 감사 — 코인 sunset 이후 멤버십 결제는 credit_transactions 에 안 남아
  // LTV/결제수에서 누락되던 문제: 완료 주문 원장을 세 번째 소스로(orderId dedupe).
  const { data: orderRows } = await service
    .from('payment_orders')
    .select('id, order_id, package_id, amount, status, created_at')
    .eq('user_id', userId)
    .in('status', ['confirmed', 'fulfilling', 'fulfilled']);
  const paymentOrders = (orderRows ?? []) as unknown as PaymentOrderHistoryRow[];

  const payment = buildPaymentHistory({
    productEntitlements,
    creditTransactions: cashCredit,
    paymentOrders,
  });

  const { data: lotRows } = await service
    .from('credit_lots')
    .select('id, user_id, amount_remaining, amount_initial, expires_at, source, metadata, created_at')
    .eq('user_id', userId);

  const lots = (lotRows ?? []) as Array<{
    id: string;
    amount_remaining: number;
    amount_initial: number;
    expires_at: string | null;
    source: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  const creditBalance = lots.reduce((s, l) => s + (l.amount_remaining ?? 0), 0);
  const expiringCut = new Date(new Date(nowIso).getTime() + 7 * 86400000).toISOString();
  const creditExpiring = lots
    .filter((l) => l.expires_at && l.expires_at <= expiringCut && (l.amount_remaining ?? 0) > 0)
    .reduce((s, l) => s + (l.amount_remaining ?? 0), 0);

  const purchaseLots = lots.filter((l) => l.source === 'purchase') as unknown as CreditRefundLotRow[];
  const creditRefund = determineCreditRefundEligibility(
    allCredit as unknown as readonly CreditRefundTransactionRow[],
    purchaseLots
  );
  const refund = determineRefundEligibility(productEntitlements, creditRefund);

  // 2026-07-04 감사 — 만료 처리는 lazy(사용자 재방문 시)라 renews_at 이 지난 행도
  // status='active'/'cancelled' 로 남음 → 요약 저장 시 'expired' 로 정규화.
  const { data: sub } = await service
    .from('subscriptions')
    .select('status, renews_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const rawSubStatus = (sub?.status as string | undefined) ?? null;
  const subRenewsAt = (sub?.renews_at as string | undefined) ?? null;
  const subscriptionStatus =
    rawSubStatus &&
    (rawSubStatus === 'active' || rawSubStatus === 'cancelled') &&
    subRenewsAt &&
    new Date(subRenewsAt).getTime() < new Date(nowIso).getTime()
      ? 'expired'
      : rawSubStatus;

  const { count: readingCount } = await service
    .from('readings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const { data: latestReading } = await service
    .from('readings')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: chatCount } = await service
    .from('dialogue_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const { data: latestChat } = await service
    .from('dialogue_messages')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const provider =
    (user.app_metadata?.provider as string | undefined) ??
    ((user.app_metadata?.providers as string[] | undefined)?.[0]) ??
    'email';

  const lastActive =
    maxIso(
      user.last_sign_in_at ?? null,
      (latestReading?.created_at as string | undefined) ?? null,
      (latestChat?.created_at as string | undefined) ?? null
    ) ?? user.created_at;

  // 2026-07-04 감사 — 기존엔 product_entitlements(카드 단건)만 세서 멤버십/전충전
  // 구매자가 'LTV>0 인데 paid_count=0'이 되던 문제: LTV 와 동일 소스(payment.entries)로 통일.
  const paidCount = payment.entries.filter((e) => (e.amountWon ?? 0) > 0).length;

  return {
    user_id: userId,
    email: user.email ?? null,
    display_name: (profile?.display_name as string | undefined) ?? null,
    signup_at: user.created_at,
    signup_provider: provider,
    profile_complete: Boolean(profile?.birth_year && profile?.gender),
    last_active_at: lastActive,
    ltv_won: payment.totalSpentWon,
    paid_count: paidCount,
    credit_balance: creditBalance,
    credit_expiring: creditExpiring,
    subscription_status: subscriptionStatus,
    refundable_won: refund.totalRefundableWon,
    reading_count: readingCount ?? 0,
    chat_count: chatCount ?? 0,
    refreshed_at: nowIso,
  };
}

export interface RefreshResult {
  processed: number;
  refreshedAt: string;
}

// 2026-06-28 — 단일 유저 요약 즉시 갱신. 전/멤버십 어드민 변경 직후 호출해
//   사용자조회(admin_user_summary, 시간당 배치)에 바로 반영. 실패는 삼킴(배치가 결국 보정).
export async function refreshAdminUserSummaryForUser(userId: string): Promise<boolean> {
  if (!hasSupabaseServiceEnv || !userId) return false;
  try {
    const service = await createServiceClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await service.auth.admin.getUserById(userId);
    if (error || !data?.user) return false;
    const u = data.user;
    const row = await computeUserSummary(
      service,
      {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        app_metadata: u.app_metadata as Record<string, unknown> | undefined,
      },
      nowIso
    );
    const { error: upsertError } = await service
      .from('admin_user_summary')
      .upsert(row, { onConflict: 'user_id' });
    return !upsertError;
  } catch {
    return false;
  }
}

// 2026-07-04 감사 — 유저당 ~10쿼리 × 전원 순차 실행은 수백 명부터 route maxDuration 을
// 초과(뒤쪽=최근 가입자가 매번 갱신 실패). 유저 단위 병렬(동시 CONCURRENCY)로 완화.
const REFRESH_CONCURRENCY = 10;

export async function refreshAdminUserSummary(): Promise<RefreshResult> {
  if (!hasSupabaseServiceEnv) return { processed: 0, refreshedAt: new Date().toISOString() };
  const service = await createServiceClient();
  const nowIso = new Date().toISOString();
  let page = 1;
  let processed = 0;
  // 전원 완주 여부 — 탈퇴자 행 정리는 완주했을 때만(부분 실행 중 삭제하면 오삭제).
  let completed = false;

  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    if (data.users.length === 0) {
      completed = true;
      break;
    }
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      app_metadata: u.app_metadata as Record<string, unknown> | undefined,
    }));
    const rows: SummaryUpsert[] = [];
    for (let i = 0; i < users.length; i += REFRESH_CONCURRENCY) {
      const chunk = users.slice(i, i + REFRESH_CONCURRENCY);
      const computed = await Promise.all(
        chunk.map((u) => computeUserSummary(service, u, nowIso))
      );
      rows.push(...computed);
    }
    if (rows.length > 0) {
      await service.from('admin_user_summary').upsert(rows, { onConflict: 'user_id' });
      processed += rows.length;
    }
    if (data.users.length < 200) {
      completed = true;
      break;
    }
    page += 1;
  }

  // 2026-07-04 감사 — 탈퇴(auth.users 삭제) 사용자의 요약 행이 영구 잔존해 가입자
  // 수·세그먼트·코호트가 과대집계되던 문제: 이번 패스에서 갱신되지 않은 행 정리.
  // (upsert 가 refreshed_at=nowIso 를 기록하므로, nowIso 미만 = auth 에 없는 유저.)
  if (completed && processed > 0) {
    const { error: cleanupError } = await service
      .from('admin_user_summary')
      .delete()
      .lt('refreshed_at', nowIso);
    if (cleanupError) {
      console.error('[summary-refresh] stale row cleanup failed:', cleanupError.message);
    }
  }

  return { processed, refreshedAt: nowIso };
}
