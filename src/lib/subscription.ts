import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import type { SubscriptionPlan } from '@/lib/payments/catalog';
import { TOPIC_PRODUCT_BY_CONCERN } from '@/app/api/today-fortune/unlock/route-helpers';

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

/** created_at(ISO) → KST 날짜 'YYYY-MM-DD'. 한국은 DST 가 없어 +9h 고정. */
const kstDayOf = (iso: string) => new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);

type LockedAccessRow = { feature: string; created_at: string; metadata: Record<string, unknown> | null };

/**
 * 멤버십 전액환불 — 그 결제 기간에 **멤버십 혜택으로 연** 달력(월)·상세풀이(일) 열람을 지운다(2026-09-14 사용자 결정).
 * ① 창마다 [start, min(end, 지금)) 안에 만든 via:'membership' 열람 행을 지운다(카카오 쿠폰 등 표식 없는 0원 행은 보존).
 * ② 스냅샷(/today-fortune/snapshots/[id]·/my/results 는 권한 검사 없이 보여준다)은 **날 단위**로 판정한다 — 지운 상세 행의 KST 날짜 중
 *    그날 다른 열람 근거(표식 없는 상세 행 = 전 결제·쿠폰·레거시, 그날 today-detail 카드 이용권)가 없는 날의 스냅샷을 창 안에서 지운다.
 *    같은 날 멤버십 행 하나로 연 다른 스냅샷(주제 전환·GET·다른 사주)도 같이 잠기고, 카드로 산 날은 멤버십 환불이 건드리지 않는다.
 *    주제 단품(재물·일, 전역) 보유자의 그 주제 스냅샷도 남긴다.
 * 🔴 무효 표시가 아니라 삭제 — unlock_credit_feature_once 는 행이 남아 있으면 reused(무과금)로 다시 연다.
 * 원장 전이(markPaymentOrderRefunded)가 방금 일어났을 때만 부른다(정확히 1회). DB 오류는 던진다 — 호출부가 흔적을 남긴다.
 * ponytail: 기간은 지급 때 기록한 그대로다. 연속 결제 A·B 중 A 를 환불하면 구독이 30일 당겨져 B 의 실제 사용 시간이
 *   기록(B 원래 창)보다 앞으로 옮겨가는데, 기록은 고치지 않는다 → 뒤에 B 를 환불하면 당겨진 구간에서 연 열람은 못 잠근다(과소 잠금).
 *   고치려면 A 환불 때 뒤 주문들의 membershipPeriods 를 같은 일수만큼 당겨 써야 한다.
 */
export async function lockMembershipContentForRefund(
  userId: string,
  windows: ReadonlyArray<{ start: string; end: string }>,
  options: { reason: string; actor?: string | null; paymentKey?: string | null; now?: Date },
  service?: SupabaseClient
): Promise<{ accessDeleted: number; snapshotsDeleted: number }> {
  if (!userId) throw new Error('사용자 없이 열람을 지우지 않는다');
  const now = options.now ?? new Date();
  const ranges = windows
    .map((w) => ({ start: new Date(w.start), end: new Date(Math.min(new Date(w.end).getTime(), now.getTime())) }))
    .filter((w) => !Number.isNaN(w.start.getTime()) && !Number.isNaN(w.end.getTime()) && w.start < w.end)
    .map((w) => ({ start: w.start.toISOString(), end: w.end.toISOString() }));

  const client = service ?? (await createServiceClient());
  // 감사 1행(revokeEntitlementsOfPayment 와 같은 feature). 실패해도 잠금 자체는 유효.
  const audit = async (metadata: Record<string, unknown>) => {
    const { error } = await client.from('credit_transactions').insert({
      user_id: userId,
      amount: 0,
      type: 'purchase',
      feature: 'entitlement_revoke',
      metadata: {
        ...metadata,
        reason: options.reason,
        actor: options.actor ?? null,
        paymentKey: options.paymentKey ?? null,
        lockedAt: now.toISOString(),
      },
    });
    if (error) console.warn('membership content lock audit write failed', error);
  };
  if (ranges.length === 0) {
    // 기간 기록이 없는 옛 주문(기록 도입 전 지급)·아직 시작 안 한 기간(연속 결제의 뒤 결제) — 조용히 넘기지 않고 사유를 남긴다.
    await audit({
      kind: 'membership_content_lock_skipped',
      skipReason: windows.length === 0 ? 'no_membership_periods' : 'no_elapsed_window',
      windows,
    });
    return { accessDeleted: 0, snapshotsDeleted: 0 };
  }

  const access: LockedAccessRow[] = [];
  const snapshots: Array<{ id: string; scope_key: string }> = [];
  let evidence: { days: Set<string>; topicConcerns: string[] } | null = null;
  for (const range of ranges) {
    const { data: deleted, error } = await client
      .from('credit_transactions')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'use')
      .in('feature', ['calendar', 'detail_report'])
      .contains('metadata', { via: 'membership' })
      .gte('created_at', range.start)
      .lt('created_at', range.end)
      .select('feature, created_at, metadata');
    if (error) throw new Error(error.message);
    const rows = (deleted ?? []) as LockedAccessRow[];
    access.push(...rows);

    const lockDays = new Set(rows.filter((r) => r.feature === 'detail_report').map((r) => kstDayOf(r.created_at)));
    if (lockDays.size === 0) continue;
    evidence ??= await loadOtherTodayDetailEvidence(client, userId);
    const days = [...lockDays].filter((day) => !evidence!.days.has(day));
    if (days.length === 0) continue;
    let query = client
      .from('today_fortune_result_snapshots')
      .delete()
      .eq('user_id', userId)
      .in('occurred_on', days)
      .gte('created_at', range.start)
      .lt('created_at', range.end);
    if (evidence.topicConcerns.length > 0) query = query.not('concern_id', 'in', `(${evidence.topicConcerns.join(',')})`);
    const { data: removed, error: snapshotError } = await query.select('id, scope_key');
    if (snapshotError) throw new Error(snapshotError.message);
    snapshots.push(...((removed ?? []) as Array<{ id: string; scope_key: string }>));
  }

  // 지운 것의 식별자(선례 revokeEntitlementsOfPayment 수준). 이름 등 원문은 넣지 않는다 — readingKey 는 이름 해시만 담는다.
  await audit({
    kind: 'membership_content_locked',
    accessDeleted: access.length,
    snapshotsDeleted: snapshots.length,
    access: access.map(({ feature, metadata }) => ({
      feature,
      kind: metadata?.kind ?? null,
      readingKey: metadata?.readingKey ?? null,
      yearMonth: metadata?.yearMonth ?? null,
      dayKey: metadata?.dayKey ?? null,
    })),
    snapshots: snapshots.map((row) => ({ id: row.id, scopeKey: row.scope_key })),
    windows: ranges,
  });
  return { accessDeleted: access.length, snapshotsDeleted: snapshots.length };
}

/**
 * 멤버십 말고 그 사용자가 오늘 상세를 열 수 있던 근거 — ①표식 없는 상세 열람 행(전 결제 charged·카카오 쿠폰 0원·레거시)의 KST 날짜
 * ②today-detail 카드 이용권의 KST 날짜(hasTodayDetailEntitlementForDay 와 같은 기준) ③보유한 주제 단품(전역)이 여는 주제.
 * 잠금 직후에 부르므로 이미 지운 멤버십 행은 없다(창 밖의 멤버십 행은 via 로 거른다).
 * ponytail: 사용자 전체 이력을 한 번 읽는다 — 상세 열람이 수천 행이 되면 날짜 구간으로 좁힐 것. 레거시 taste_product 주제 구매는 안 본다.
 */
async function loadOtherTodayDetailEvidence(client: SupabaseClient, userId: string) {
  const { data: detailRows, error } = await client
    .from('credit_transactions')
    .select('created_at, metadata')
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', 'detail_report');
  if (error) throw new Error(error.message);
  const { data: productRows, error: productError } = await client
    .from('product_entitlements')
    .select('product_id, created_at')
    .eq('user_id', userId)
    .in('product_id', ['today-detail', ...Object.values(TOPIC_PRODUCT_BY_CONCERN)]);
  if (productError) throw new Error(productError.message);

  const products = (productRows ?? []) as Array<{ product_id: string; created_at: string }>;
  const days = new Set([
    ...((detailRows ?? []) as Array<{ created_at: string; metadata: Record<string, unknown> | null }>)
      .filter((row) => row.metadata?.via !== 'membership')
      .map((row) => kstDayOf(row.created_at)),
    ...products.filter((row) => row.product_id === 'today-detail').map((row) => kstDayOf(row.created_at)),
  ]);
  const held = new Set(products.map((row) => row.product_id));
  const topicConcerns = Object.entries(TOPIC_PRODUCT_BY_CONCERN)
    .filter(([, productId]) => held.has(productId))
    .map(([concern]) => concern);
  return { days, topicConcerns };
}

/** 관리자 멤버십 해제 — 혜택을 **지금** 끊는다(2026-09-14). cancelled 는 renews_at 까지 권한이 남고(isEntitledStatus)
 *  사용자가 재개할 수 있어 해제가 안 됐다. renews_at 도 지금으로 내린다(남기면 재구매 때 activate 의 base 로 되살아난다). */
export async function expireMembershipNow(userId: string, options: { now?: Date; service?: SupabaseClient } = {}) {
  const client = options.service ?? (await createServiceClient());
  const now = (options.now ?? new Date()).toISOString();
  const { error } = await client
    .from('subscriptions')
    .update({ status: 'expired', renews_at: now, updated_at: now })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
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
