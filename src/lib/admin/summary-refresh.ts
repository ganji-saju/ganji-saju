// src/lib/admin/summary-refresh.ts
// admin_user_summary 매시간 배치 갱신. service_role. 상세와 동일 로직 재사용.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  buildPaymentHistory,
  isCashCreditTransaction,
  type CreditTransactionHistoryRow,
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
  const payment = buildPaymentHistory({ productEntitlements, creditTransactions: cashCredit });

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

  const { data: sub } = await service
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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

  const paidCount = productEntitlements.filter((e) => ((e.amount ?? 0) as number) > 0).length;

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
    subscription_status: (sub?.status as string | undefined) ?? null,
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

export async function refreshAdminUserSummary(): Promise<RefreshResult> {
  if (!hasSupabaseServiceEnv) return { processed: 0, refreshedAt: new Date().toISOString() };
  const service = await createServiceClient();
  const nowIso = new Date().toISOString();
  let page = 1;
  let processed = 0;

  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error || data.users.length === 0) break;
    const rows: SummaryUpsert[] = [];
    for (const u of data.users) {
      rows.push(
        await computeUserSummary(
          service,
          {
            id: u.id,
            email: u.email ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            app_metadata: u.app_metadata as Record<string, unknown> | undefined,
          },
          nowIso
        )
      );
    }
    if (rows.length > 0) {
      await service.from('admin_user_summary').upsert(rows, { onConflict: 'user_id' });
      processed += rows.length;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return { processed, refreshedAt: nowIso };
}
