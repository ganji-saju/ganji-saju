import { redirect } from 'next/navigation';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { BirthInput, Stem } from '@/lib/saju/types';
import {
  listPaidReadingSnapshotsForUser,
  type PaidReadingSnapshot,
} from '@/lib/payments/paid-reading-snapshots';
import {
  buildSajuPersonalityResultHref,
  isSajuPersonalityMiniProductId,
} from '@/lib/payments/saju-personality';

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
  if (isSajuPersonalityMiniProductId(snapshot.productId)) {
    return buildSajuPersonalityResultHref(snapshot.scopeKey);
  }
  if (snapshot.productId === 'money-pattern') return '/saju/new?topic=wealth';
  if (snapshot.productId === 'work-flow') return '/saju/new?topic=career';

  return '/my/results';
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

  const [creditsResponse, subscription, readingCountResponse, readingsResponse, transactionsResponse, purchasedResults] =
    await Promise.all([
      supabase
        .from('user_credits')
        .select('balance, subscription_balance')
        .eq('user_id', user.id)
        .maybeSingle(),
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
    ]);

  assertAccountQueryOk(creditsResponse.error, '코인');
  assertAccountQueryOk(readingCountResponse.error, '저장 결과 개수');
  assertAccountQueryOk(readingsResponse.error, '저장 결과 목록');
  assertAccountQueryOk(transactionsResponse.error, '코인 이용 이력');

  const balance = creditsResponse.data?.balance ?? 0;
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

          const sajuData = normalizeToSajuDataV1(input, reading.result_json);

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
    purchasedResults: purchasedResults.map((snapshot) => ({
      id: snapshot.id,
      title: snapshot.title,
      summary: snapshot.summary,
      productId: snapshot.productId,
      href: buildPurchasedResultHref(snapshot),
      createdAt: snapshot.createdAt,
      occurredOn: snapshot.occurredOn,
    })),
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
