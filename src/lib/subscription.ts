import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import type { SubscriptionPlan } from '@/lib/payments/catalog';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

/** 멤버십 결제 1건이 구독에 더하는 일수. 지급이 주문에 기록하고(recordMembershipDaysGranted) 환불은 그 기록만 뺀다. */
export const MEMBERSHIP_PERIOD_DAYS = 30;

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

// 2026-06-30 — 해지 예약(cancelled)은 renews_at 까지 유효(billing 카피가 명시 약속).
//   expireIfNeeded 가 기간 경과 시 'expired'로 정규화하므로, 'cancelled'는 곧 grace 기간 내.
export function isEntitledStatus(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'cancelled';
}

// 2026-06-28 — 프리미엄 멤버십(월 49,000원 30일권) 혜택 게이트 공통 판별.
//   active 또는 cancelled(grace 기간) + plan='premium_monthly' 이면 멤버.
export async function isPremiumMember(userId: string): Promise<boolean> {
  if (!userId) return false;
  const sub = await getManagedSubscription(userId);
  return !!sub && isEntitledStatus(sub.status) && sub.plan === 'premium_monthly';
}

// 2026-06-30 — 활성 구독의 등급(tier) 반환. 피처 게이트가 tier별 혜택 분기에 사용.
//   entitled(active|cancelled) 아니면 null, plan 불일치도 null.
export async function getMemberTier(userId: string): Promise<'premium' | null> {
  if (!userId) return null;
  const sub = await getManagedSubscription(userId);
  if (!sub || !isEntitledStatus(sub.status)) return null;
  return sub.plan === 'premium_monthly' ? 'premium' : null;
}

// 2026-08-31 — 현재 세션 사용자의 등급. 페이지가 "멤버십으로 이미 열려 있음" 고지를
//   분기할 때 사용(중복결제 안내). env 부재·비로그인·조회 오류는 전부 null(고지 생략).
export async function getViewerMemberTier(): Promise<'premium' | null> {
  if (!hasSupabaseServerEnv) return null;
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    return user ? await getMemberTier(user.id) : null;
  } catch {
    return null;
  }
}

/**
 * 환불된 멤버십 결제 1건이 늘린 기간을 뺀 뒤의 구독(순수, 2026-09-13).
 * 구독은 사용자당 1행이고 결제(30일)·관리자 부여가 renews_at 끝에 누적된다 → "지금 종료"는 다른 기간까지 날리고,
 * 상태만 cancelled 는 혜택이 안 끊긴다(isEntitledStatus). 그래서 이 결제의 30일만 뺀다.
 * 결과가 지금 이전이면 즉시 만료 — renews_at 도 지금으로 내린다(남기면 재구매 때 activate 의 base 로 되살아난다).
 * renews_at 이 없는(무기한) 행은 이 결제가 만든 기간이 아니라 손대지 않는다(null).
 * 뺄 일수는 호출부가 **주문의 지급 기록**(metadata.membershipDaysGranted)으로 정한다 — 미지급 0 · 지급 재시도 누적(60).
 */
export function refundedMembershipRenewal(
  renewsAt: string | null,
  now: Date,
  days: number
): { status: 'expired' | null; renewsAt: string } | null {
  if (!renewsAt) return null;
  const shortened = addDays(new Date(renewsAt), -days);
  return new Date(shortened).getTime() <= now.getTime()
    ? { status: 'expired', renewsAt: now.toISOString() }
    : { status: null, renewsAt: shortened };
}

/** 멤버십 환불 — 구독에서 이 결제가 더한 일수를 뺀다. 원장 전이(markPaymentOrderRefunded)가 방금 일어났을 때만 부른다(정확히 1회).
 *  ponytail: select→update 라 같은 순간의 재구매(activate)와 겹치면 한쪽 갱신이 사라진다 — 원자 RPC 는 마이그레이션이 필요해 보류. */
export async function shortenMembershipForRefund(
  userId: string,
  options: { days: number; now?: Date; service?: SupabaseClient }
) {
  const client = options.service ?? (await createServiceClient());
  const now = options.now ?? new Date();
  const { data, error } = await client.from('subscriptions').select('renews_at').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  const next = refundedMembershipRenewal((data as { renews_at: string | null } | null)?.renews_at ?? null, now, options.days);
  if (!next) return null;
  const { error: updateError } = await client
    .from('subscriptions')
    .update({ renews_at: next.renewsAt, ...(next.status ? { status: next.status } : {}), updated_at: now.toISOString() })
    .eq('user_id', userId);
  if (updateError) throw new Error(updateError.message);
  return next;
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
  const days = options.days ?? MEMBERSHIP_PERIOD_DAYS;
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
  if (plan === 'premium_monthly') {
    return '프리미엄 대화 멤버십';
  }

  return plan;
}
