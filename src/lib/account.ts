import { redirect } from 'next/navigation';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';
import { loadSajuDataV2 } from '@/domain/saju/engine';
import type { BirthInput, Stem } from '@/lib/saju/types';
import {
  listPaidReadingSnapshotsForUser,
  type PaidReadingSnapshot,
} from '@/lib/payments/paid-reading-snapshots';
import {
  buildTodayFortuneResultSnapshotHref,
  buildTodayFortuneResultSnapshotSummary,
  listTodayFortuneResultSnapshotsForUser,
} from '@/lib/today-fortune/result-snapshots';
import {
  buildTodayFortuneRunSummary,
  listTodayFortuneRunsForUser,
} from '@/lib/today-fortune/run-log';
import {
  buildTarotResultSnapshotHref,
  listTarotResultSnapshotsForUser,
} from '@/lib/tarot/result-snapshots';
import { getNonExpiredLotBalance } from '@/lib/credits/deduct';
import {
  buildPaymentHistory,
  isCashCreditTransaction,
  type CreditTransactionHistoryRow,
  type PaymentHistoryEntry,
  type PaymentHistoryResult,
  type PaymentOrderHistoryRow,
  type ProductEntitlementHistoryRow,
} from '@/lib/billing/payment-history';

export interface AccountCredits {
  balance: number;
  subscriptionBalance: number;
  total: number;
}

export interface AccountSubscription {
  status: 'active' | 'cancelled' | 'expired';
  plan: string;
  renewsAt: string | null;
  createdAt: string;
}

export interface AccountReading {
  id: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number | null;
  gender: 'male' | 'female' | null;
  createdAt: string;
  dayMasterStem: Stem | null;
  dayPillarLabel: string | null;
}

export interface AccountPurchasedResult {
  id: string;
  title: string;
  summary: string | null;
  productId: string;
  // 2026-05-18 Phase 7b — 후기 작성 시 entitlement scope 매칭에 필요.
  scopeKey: string;
  href: string;
  createdAt: string;
  occurredOn: string | null;
}

export interface AccountTransaction {
  id: string;
  amount: number;
  type: 'purchase' | 'subscription' | 'use' | 'signup_bonus';
  feature: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface AccountDashboardData {
  user: {
    id: string;
    email: string | null;
  };
  credits: AccountCredits;
  subscription: AccountSubscription | null;
  readingCount: number;
  recentReadings: AccountReading[];
  purchasedResults: AccountPurchasedResult[];
  recentTransactions: AccountTransaction[];
}

function buildLocalPreviewDashboard(): AccountDashboardData {
  return {
    user: {
      id: 'local-preview',
      email: 'preview@dalbit.local',
    },
    credits: {
      balance: 0,
      subscriptionBalance: 0,
      total: 0,
    },
    subscription: null,
    readingCount: 0,
    recentReadings: [],
    purchasedResults: [],
    recentTransactions: [],
  };
}

function getResponseErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message ?? '알 수 없는 오류가 발생했습니다.');
  }

  return '알 수 없는 오류가 발생했습니다.';
}

function assertAccountQueryOk(error: unknown, label: string) {
  if (!error) return;
  throw new Error(`${label} 정보를 불러오지 못했습니다. ${getResponseErrorMessage(error)}`);
}

function buildPurchasedResultHref(snapshot: PaidReadingSnapshot) {
  const slug = snapshot.sourceSlug ?? snapshot.readingId;

  if (snapshot.productId === 'today-detail') {
    if (slug) return `/saju/${encodeURIComponent(slug)}/today-detail`;
    return '/today-fortune';
  }

  if (snapshot.productId === 'monthly-calendar' && slug) {
    return `/saju/${encodeURIComponent(slug)}/premium#fortune-calendar`;
  }

  if (snapshot.productId === 'year-core' && slug) {
    return `/saju/${encodeURIComponent(slug)}/premium#yearly-report`;
  }

  if (snapshot.productId === 'lifetime-report' && slug) {
    return `/saju/${encodeURIComponent(slug)}/premium`;
  }

  if (snapshot.productId === 'love-question') return '/compatibility/input';
  // 2026-07-19 — 주제 단품은 today-detail 화면을 해당 주제로 연다(재물=wealth, 일=career).
  //   기존 `/saju/new?topic=...` 은 **입력폼**이고 그 폼은 topic 을 읽지도 않아
  //   구매자가 빈 화면을 만났다.
  if ((snapshot.productId === 'money-pattern' || snapshot.productId === 'work-flow') && slug) {
    const topic = snapshot.productId === 'money-pattern' ? 'wealth' : 'career';
    return `/saju/${encodeURIComponent(slug)}/today-detail?topic=${topic}`;
  }

  return '/my/results';
}

function paidSnapshotIdentity(snapshot: PaidReadingSnapshot) {
  return snapshot.productId === 'today-detail' && snapshot.readingKey && snapshot.occurredOn
    ? `${snapshot.readingKey}__${snapshot.occurredOn}`
    : null;
}

export async function requireAccount(redirectPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(redirectPath)}`);
  }

  return { supabase, user };
}

export async function getAccountDashboardData(
  redirectPath: string,
  options: { readingLimit?: number; readingOffset?: number; transactionLimit?: number } = {}
): Promise<AccountDashboardData> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return buildLocalPreviewDashboard();
  }

  const { supabase, user } = await requireAccount(redirectPath);
  const readingLimit = options.readingLimit ?? 5;
  const readingOffset = Math.max(0, options.readingOffset ?? 0);
  const transactionLimit = options.transactionLimit ?? 6;

  const [
    creditsResponse,
    lotBalance,
    subscription,
    readingCountResponse,
    readingsResponse,
    transactionsResponse,
    purchasedResults,
    todayFortuneSnapshots,
    tarotSnapshots,
    todayFortuneRuns,
  ] =
    await Promise.all([
      supabase
        .from('user_credits')
        .select('balance, subscription_balance')
        .eq('user_id', user.id)
        .maybeSingle(),
      // 결제 재화는 1년 만료 — 표시 잔액은 비만료 lot 합으로 계산(구독 잔액은 별도).
      getNonExpiredLotBalance(user.id),
      getManagedSubscription(user.id),
      supabase
        .from('readings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('readings')
        .select('id, birth_year, birth_month, birth_day, birth_hour, gender, created_at, result_json')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(readingOffset, readingOffset + readingLimit - 1),
      supabase
        .from('credit_transactions')
        .select('id, amount, type, feature, metadata, created_at')
        .eq('user_id', user.id)
        .neq('amount', 0)
        .order('created_at', { ascending: false })
        .limit(transactionLimit),
      listPaidReadingSnapshotsForUser(user.id, {
        limit: Math.max(readingLimit, 10),
        offset: readingOffset,
      }),
      listTodayFortuneResultSnapshotsForUser(user.id, {
        limit: Math.max(readingLimit, 10),
        offset: readingOffset,
      }),
      listTarotResultSnapshotsForUser(user.id, {
        limit: Math.max(readingLimit, 10),
        offset: readingOffset,
      }),
      // 2026-07-10 — 무료 오늘운세 실행기록(결정론 재현용). 유료 스냅샷과 같은 날짜면 아래에서 제거.
      listTodayFortuneRunsForUser(user.id, Math.max(readingLimit, 10)),
    ]);

  assertAccountQueryOk(creditsResponse.error, '재화');
  assertAccountQueryOk(readingCountResponse.error, '저장 결과 개수');
  assertAccountQueryOk(readingsResponse.error, '저장 결과 목록');
  assertAccountQueryOk(transactionsResponse.error, '전 이용 이력');

  const balance = lotBalance;
  const subscriptionBalance = creditsResponse.data?.subscription_balance ?? 0;

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    credits: {
      balance,
      subscriptionBalance,
      total: balance + subscriptionBalance,
    },
    readingCount: readingCountResponse.count ?? readingsResponse.data?.length ?? 0,
    subscription: subscription
      ? {
          status: subscription.status,
          plan: subscription.plan,
          renewsAt: subscription.renewsAt,
          createdAt: subscription.createdAt,
        }
      : null,
    recentReadings:
      readingsResponse.data?.map((reading) => ({
        ...(function readSajuSnapshot() {
          const input: BirthInput = {
            year: reading.birth_year,
            month: reading.birth_month,
            day: reading.birth_day,
            hour: reading.birth_hour ?? undefined,
            gender: reading.gender ?? undefined,
          };

          const sajuData = loadSajuDataV2(input, reading.result_json);

          return {
            dayMasterStem: sajuData.dayMaster.stem,
            dayPillarLabel: `${sajuData.pillars.day.stem}${sajuData.pillars.day.branch}일주`,
          };
        })(),
        id: reading.id,
        birthYear: reading.birth_year,
        birthMonth: reading.birth_month,
        birthDay: reading.birth_day,
        birthHour: reading.birth_hour,
        gender: reading.gender,
        createdAt: reading.created_at,
      })) ?? [],
    purchasedResults: [
      ...todayFortuneSnapshots.map((snapshot) => ({
        id: snapshot.id,
        title: '오늘 자세히 보기',
        summary: buildTodayFortuneResultSnapshotSummary(snapshot.occurredOn),
        productId: 'today-detail',
        scopeKey: snapshot.scopeKey,
        href: buildTodayFortuneResultSnapshotHref(snapshot.id),
        createdAt: snapshot.createdAt,
        occurredOn: snapshot.occurredOn,
      })),
      // 2026-07-10 — 무료 오늘운세는 결과 본문을 저장하지 않고 실행기록만 남긴다.
      //   '다시보기'는 /today-fortune/runs/[id] 에서 생성 당시 now 로 결정론 재계산.
      //   같은 날 유료 '오늘 자세히 보기'가 있으면 그쪽이 상위 호환이라 무료 항목은 숨긴다.
      ...todayFortuneRuns
        .filter((run) => !todayFortuneSnapshots.some((snap) => snap.occurredOn === run.occurredOn))
        .map((run) => ({
          id: run.id,
          title: '오늘의 운세',
          summary: buildTodayFortuneRunSummary(run.occurredOn, run.generatedAt),
          productId: 'today-run',
          scopeKey: `today-run:${run.id}`,
          href: `/today-fortune/runs/${run.id}`,
          createdAt: run.createdAt,
          occurredOn: run.occurredOn,
        })),
      ...purchasedResults
        .filter((snapshot) => {
          const identity = paidSnapshotIdentity(snapshot);
          if (!identity) return true;
          return !todayFortuneSnapshots.some(
            (todaySnapshot) =>
              `${todaySnapshot.readingKey}__${todaySnapshot.occurredOn}` === identity
          );
        })
        .map((snapshot) => ({
          id: snapshot.id,
          title: snapshot.title,
          summary: snapshot.summary,
          productId: snapshot.productId,
          scopeKey: snapshot.scopeKey,
          href: buildPurchasedResultHref(snapshot),
          createdAt: snapshot.createdAt,
          occurredOn: snapshot.occurredOn,
        })),
      ...tarotSnapshots.map((snapshot) => ({
        id: snapshot.id,
        title: snapshot.cardName,
        summary: snapshot.question,
        productId: 'tarot-daily',
        scopeKey: snapshot.scopeKey,
        href: buildTarotResultSnapshotHref({
          question: snapshot.question,
          cardId: snapshot.cardId,
          orientation: snapshot.orientation,
        }),
        createdAt: snapshot.createdAt,
        occurredOn: null,
      })),
    ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    recentTransactions:
      transactionsResponse.data?.map((transaction) => ({
        id: transaction.id,
        amount: transaction.amount,
        type: transaction.type,
        feature: transaction.feature,
        createdAt: transaction.created_at,
        metadata:
          transaction.metadata && typeof transaction.metadata === 'object'
            ? (transaction.metadata as Record<string, unknown>)
            : null,
      })) ?? [],
  };
}

export interface PaymentHistoryData {
  /** 현금(현금 결제) 내역 — 날짜 역순. */
  entries: PaymentHistoryEntry[];
  /** 총 결제액(원). */
  totalSpentWon: number;
  /** 결제 건수. */
  count: number;
}

// 2026-05-25 — /my/billing 현금 결제 내역.
//   - product_entitlements (단건 풀이 · 평생 리포트, amount=WON)
//   - credit_transactions type IN ('purchase','subscription') (전 충전 · 멤버십)
//     단 legacy taste_product audit / entitlement_revoke audit 행은 제외(중복·비결제).
// getAccountDashboardData 와 동일한 server supabase + 인증 패턴을 재사용한다.
// (getAccountDashboardData 의 반환 모양은 건드리지 않는 별도 fn — 다른 호출부 안전.)
export async function getPaymentHistory(
  redirectPath: string
): Promise<PaymentHistoryData> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return { entries: [], totalSpentWon: 0, count: 0 };
  }

  const { supabase, user } = await requireAccount(redirectPath);

  const [entitlementsResponse, cashTransactionsResponse, ordersResponse] = await Promise.all([
    supabase
      .from('product_entitlements')
      .select('id, product_id, amount, order_id, payment_key, package_id, created_at, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    // 현금 결제만 — coin pack(purchase) + 멤버십(subscription). taste_product /
    // entitlement_revoke 는 amount=0 audit·비결제라 SELECT 단계에서 배제(product_entitlements 와 중복 방지).
    supabase
      .from('credit_transactions')
      .select('id, type, amount, feature, metadata, created_at')
      .eq('user_id', user.id)
      .in('type', ['purchase', 'subscription'])
      .order('created_at', { ascending: false }),
    // 2026-07-04 — 코인 sunset 이후 멤버십 결제는 credit_transactions 에 안 남아
    // 빌링 내역에 안 보이던 문제: 완료 주문 원장 보강(buildPaymentHistory 가 orderId dedupe).
    supabase
      .from('payment_orders')
      .select('id, order_id, package_id, amount, status, created_at')
      .eq('user_id', user.id)
      .in('status', ['confirmed', 'fulfilling', 'fulfilled'])
      .order('created_at', { ascending: false }),
  ]);

  assertAccountQueryOk(entitlementsResponse.error, '상품 결제 내역');
  assertAccountQueryOk(cashTransactionsResponse.error, '전·멤버십 결제 내역');

  const productEntitlements = (entitlementsResponse.data ?? []).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    amount: row.amount ?? null,
    order_id: row.order_id ?? null,
    payment_key: row.payment_key ?? null,
    package_id: row.package_id ?? null,
    created_at: row.created_at,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null,
  })) satisfies ProductEntitlementHistoryRow[];

  const creditTransactions = (cashTransactionsResponse.data ?? [])
    .filter((row) =>
      isCashCreditTransaction({
        type: row.type,
        feature: row.feature,
        metadata:
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : null,
      })
    )
    .map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : null,
      created_at: row.created_at,
    })) satisfies CreditTransactionHistoryRow[];

  const result: PaymentHistoryResult = buildPaymentHistory({
    productEntitlements,
    creditTransactions,
    paymentOrders: ((ordersResponse.data ?? []) as unknown as PaymentOrderHistoryRow[]),
  });

  return {
    entries: result.entries,
    totalSpentWon: result.totalSpentWon,
    count: result.count,
  };
}
