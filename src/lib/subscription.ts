import { createServiceClient } from '@/lib/supabase/server';
import type { SubscriptionPlan } from '@/lib/payments/catalog';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export interface ManagedSubscription {
  status: SubscriptionStatus;
  plan: string;
  renewsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionRow {
  status: SubscriptionStatus;
  plan: string;
  renews_at: string | null;
  created_at: string;
  updated_at: string;
  toss_billing_key: string | null;
  toss_customer_key: string | null;
}

function mapSubscription(row: SubscriptionRow): ManagedSubscription {
  return {
    status: row.status,
    plan: row.plan,
    renewsAt: row.renews_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isExpired(row: Pick<SubscriptionRow, 'renews_at'>) {
  return !!row.renews_at && new Date(row.renews_at).getTime() <= Date.now();
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

async function readSubscription(userId: string) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('subscriptions')
    .select('status, plan, renews_at, created_at, updated_at, toss_billing_key, toss_customer_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SubscriptionRow | null;
}

async function expireIfNeeded(userId: string, subscription: SubscriptionRow) {
  if (!isExpired(subscription) || subscription.status === 'expired') {
    return subscription;
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from('subscriptions')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('status, plan, renews_at, created_at, updated_at, toss_billing_key, toss_customer_key')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '구독 상태를 갱신하지 못했습니다.');
  }

  return data as SubscriptionRow;
}

export async function getManagedSubscription(userId: string): Promise<ManagedSubscription | null> {
  const subscription = await readSubscription(userId);

  if (!subscription) {
    return null;
  }

  const normalized = await expireIfNeeded(userId, subscription);
  return mapSubscription(normalized);
}

// 2026-06-28 — 프리미엄 멤버십(월 49,000원 30일권) 혜택 게이트 공통 판별.
//   active + plan='premium_monthly' 이면 멤버. expireIfNeeded 가 만료를 status='expired'로 정규화.
export async function isPremiumMember(userId: string): Promise<boolean> {
  if (!userId) return false;
  const sub = await getManagedSubscription(userId);
  return sub?.status === 'active' && sub.plan === 'premium_monthly';
}

// 2026-06-30 — 라이트(플러스) 멤버십(월 4,900원 30일권) 혜택 게이트 공통 판별.
//   active + plan='plus_monthly' 이면 멤버. isPremiumMember 패턴과 동일.
export async function isPlusMember(userId: string): Promise<boolean> {
  if (!userId) return false;
  const sub = await getManagedSubscription(userId);
  return sub?.status === 'active' && sub.plan === 'plus_monthly';
}

// 2026-06-30 — 활성 구독의 등급(tier) 반환. 피처 게이트가 tier별 혜택 분기에 사용.
//   active 아니면 null, plan 불일치도 null.
export async function getMemberTier(userId: string): Promise<'premium' | 'plus' | null> {
  if (!userId) return null;
  const sub = await getManagedSubscription(userId);
  if (sub?.status !== 'active') return null;
  if (sub.plan === 'premium_monthly') return 'premium';
  if (sub.plan === 'plus_monthly') return 'plus';
  return null;
}

export async function activatePlusSubscription(
  userId: string,
  options: { customerKey?: string | null; billingKey?: string | null } = {}
) {
  return activateMembershipSubscription(userId, {
    ...options,
    plan: 'plus_monthly',
  });
}

export async function activateMembershipSubscription(
  userId: string,
  options: {
    plan: SubscriptionPlan;
    days?: number;
    customerKey?: string | null;
    billingKey?: string | null;
  }
) {
  const service = await createServiceClient();
  const existing = await readSubscription(userId);
  const now = new Date();
  const days = options.days ?? 30;
  const baseDate =
    existing?.renews_at && new Date(existing.renews_at).getTime() > now.getTime()
      ? new Date(existing.renews_at)
      : now;

  const { data, error } = await service
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        status: 'active',
        plan: options.plan,
        renews_at: addDays(baseDate, days),
        toss_customer_key: options.customerKey ?? existing?.toss_customer_key ?? null,
        toss_billing_key: options.billingKey ?? existing?.toss_billing_key ?? null,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('status, plan, renews_at, created_at, updated_at, toss_billing_key, toss_customer_key')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '라이트 멤버십 상태를 시작하지 못했습니다.');
  }

  return mapSubscription(data as SubscriptionRow);
}

export async function updateSubscriptionStatus(
  userId: string,
  nextStatus: Extract<SubscriptionStatus, 'active' | 'cancelled'>
) {
  const current = await readSubscription(userId);

  if (!current) {
    throw new Error('구독 정보가 없습니다.');
  }

  const normalized = await expireIfNeeded(userId, current);
  if (normalized.status === 'expired') {
    throw new Error('이미 만료된 라이트 멤버십입니다. 다시 시작해 주세요.');
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from('subscriptions')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('status, plan, renews_at, created_at, updated_at, toss_billing_key, toss_customer_key')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '구독 상태를 바꾸지 못했습니다.');
  }

  return mapSubscription(data as SubscriptionRow);
}

export function getSubscriptionStatusLabel(status: SubscriptionStatus) {
  switch (status) {
    case 'active':
      return '이용 중';
    case 'cancelled':
      return '해지 예약';
    case 'expired':
      return '만료';
    default:
      return status;
  }
}

export function getSubscriptionPlanLabel(plan: string) {
  if (plan === 'plus_monthly') {
    return '라이트 대화 멤버십';
  }

  if (plan === 'premium_monthly') {
    return '프리미엄 대화 멤버십';
  }

  return plan;
}
