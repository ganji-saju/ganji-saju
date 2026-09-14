import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, createServiceClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import type { SubscriptionPlan, TasteProductId } from '@/lib/payments/catalog';
import { TOPIC_PRODUCT_BY_CONCERN } from '@/lib/today-fortune/topic-products';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

/** 멤버십 결제 1건이 구독에 더하는 일수. 기간의 정본은 membership_periods(086). */
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

async function readSubscription(userId: string, client?: SupabaseClient) {
  const service = client ?? (await createServiceClient());
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

// ── 멤버십 기간 원장(membership_periods, migration 086 · 설계 docs/membership-period-ledger-design.md) ──
//   불변식: 살아 있는(voided_at null) 기간은 겹치지 않는 사슬이고 subscriptions.renews_at = 살아 있는 max(end_at).
//   지급·관리자 부여·해제·환불이 전부 이 표를 먼저 고치고 구독을 그 끝에 맞춘다 — 환불 잠금 창도 이 표에서 나온다.
//   겹침은 DB 배제 제약(membership_periods_live_no_overlap)이 막는다 — 모든 update 는 겹침을 만들지 않는 순서로 한다(무효 먼저·당기기는 start_at 오름차순).
//   ponytail: 여러 문장(select→update)이라 같은 사용자의 동시 변경은 한쪽이 23P01(겹침)로 실패하거나 구독 끝이 어긋날 수 있다 — 원자 RPC 로 옮길 때 같이.
type PeriodRow = {
  id: string;
  order_id: string | null;
  start_at: string;
  end_at: string;
  voided_at: string | null;
  void_reason: string | null;
};
const PERIOD_COLUMNS = 'id, order_id, start_at, end_at, voided_at, void_reason';
const ms = (value: string) => Date.parse(value);
const iso = (t: number) => new Date(t).toISOString();
const lastEnd = (rows: PeriodRow[]) => (rows.length > 0 ? Math.max(...rows.map((row) => ms(row.end_at))) : null);

async function livePeriods(client: SupabaseClient, userId: string): Promise<PeriodRow[]> {
  const { data, error } = await client
    .from('membership_periods')
    .select(PERIOD_COLUMNS)
    .eq('user_id', userId)
    .is('voided_at', null)
    .order('start_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PeriodRow[];
}

/** 그 사용자의 기간 행(무효 포함). orderId 를 주면 그 주문 행만. */
async function userPeriods(client: SupabaseClient, userId: string, orderId?: string): Promise<PeriodRow[]> {
  let query = client.from('membership_periods').select(PERIOD_COLUMNS).eq('user_id', userId);
  if (orderId) query = query.eq('order_id', orderId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PeriodRow[];
}

async function updatePeriod(client: SupabaseClient, id: string, patch: Record<string, string>) {
  const { error } = await client.from('membership_periods').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

async function updateSubscriptionEnd(client: SupabaseClient, userId: string, renewsAt: number, expired: boolean, now: Date) {
  const { error } = await client
    .from('subscriptions')
    .update({ renews_at: iso(renewsAt), ...(expired ? { status: 'expired' } : {}), updated_at: now.toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** at 이후의 살아 있는 기간을 끊는다 — 진행 중(start < at)은 end = at, 그 뒤 기간은 무효(voidReason). */
async function cutLivePeriodsAt(client: SupabaseClient, userId: string, at: number, now: Date, voidReason: string) {
  for (const row of await livePeriods(client, userId)) {
    if (ms(row.end_at) <= at) continue;
    await updatePeriod(
      client,
      row.id,
      ms(row.start_at) < at ? { end_at: iso(at) } : { voided_at: now.toISOString(), void_reason: voidReason }
    );
  }
}

/**
 * 멤버십 전액환불(설계 연산 2) — 그 결제의 기간 행 P 를 무효(refund)로 하고, P 뒤에 이어 붙은 기간을 P 가 비운 시간만큼 당긴다
 *   (환불이 P 시작 전 = P 전체 · 진행 중 = P.end − 지금 · 이미 끝남 = 0). 구독은 살아 있는 끝으로 맞추고, 남은 게 없거나 끝이 지금 이전이면
 *   즉시 만료(renews_at = 지금 — 남기면 재구매 때 activate 의 base 로 되살아난다).
 * 반환: 표가 이 주문을 아는가. false = 표에 이 주문 기간이 없다(086 적용~배포 사이 옛 코드 지급 등) — 아무것도 안 바꾸고,
 *   호출부가 지급된 주문이면 'membership_period_missing' 으로 드러낸다(구독 수동 차감). 폴백 차감(#820)은 삭제 — 정본은 표 하나.
 *   이미 무효인 P(관리자 해제로 무효된 미래 기간·재호출)는 아무것도 안 바꾸고 true.
 * 순서: P 무효 → 당기기(start_at 오름차순) → 구독 — 배제 제약이 받아들이는 유일한 순서. 중간에 끊기면 겹침이 아니라 "덜 당겨진 틈"(사용자 쪽 이득)만
 *   남는다 — 호출부가 last_error·운영 메일로 드러낸다.
 * 원장 전이(markPaymentOrderRefunded)가 방금 일어났을 때만 부른다(정확히 1회).
 */
export async function refundMembershipPeriod(
  userId: string,
  orderId: string,
  options: { now?: Date; service?: SupabaseClient } = {}
): Promise<boolean> {
  const client = options.service ?? (await createServiceClient());
  const now = options.now ?? new Date();
  const t = now.getTime();
  const rows = await userPeriods(client, userId, orderId);
  const period = rows.find((row) => row.voided_at == null);
  if (!period) return rows.length > 0;

  const start = ms(period.start_at);
  const end = ms(period.end_at);
  const shift = t < start ? end - start : t < end ? end - t : 0;
  await updatePeriod(client, period.id, { voided_at: now.toISOString(), void_reason: 'refund' });
  await pullLaterAndSyncSubscription(client, userId, end, shift, now);
  return true;
}

/** start_at ≥ from 인 살아 있는 기간을 shift 만큼 당기고(start_at 오름차순 — 배제 제약이 받는 순서) 구독을 살아 있는 끝에 맞춘다
 *  (남은 게 없거나 끝이 지금 이전이면 즉시 만료, renews_at = 지금). */
async function pullLaterAndSyncSubscription(client: SupabaseClient, userId: string, from: number, shift: number, now: Date) {
  const t = now.getTime();
  const rest = await livePeriods(client, userId);
  for (const row of rest) {
    if (shift === 0 || ms(row.start_at) < from) continue;
    row.start_at = iso(ms(row.start_at) - shift);
    row.end_at = iso(ms(row.end_at) - shift);
    await updatePeriod(client, row.id, { start_at: row.start_at, end_at: row.end_at });
  }
  const last = lastEnd(rest);
  const expired = last === null || last <= t;
  await updateSubscriptionEnd(client, userId, expired ? t : last, expired, now);
}

/** 일부 환불로 잘린 조각(무효 행)의 void_reason — 취소 거래(나이스 cancels[].tid) 단위 적용 기록이다. */
export const partialRefundMarker = (cancelTid: string) => `partial_refund:${cancelTid}`;

/**
 * 멤버십 일부 환불(설계 연산 4, 2026-09-14 사용자 결정) — 환불 비율만큼 그 결제 기간 P=[s,e) 를 뒤에서 줄인다.
 *   k = round(30일 × 부분환불액 / 주문금액)(ms) · newEnd = e − k · 뒤 기간 당김 = max(0, e − max(newEnd, t)).
 *   잘린 조각 [newEnd, e) 는 이 주문의 **무효 행**(void_reason partial_refund:<취소 거래 tid>, voided_at t)으로 남긴다 →
 *   ① 잠금 창이 lockMembershipContentForRefund 규칙 그대로 [newEnd, min(e, t)) 가 되고 ② 같은 취소 거래를 두 번 적용하지 않는 기록이 된다
 *   (관리자 부분취소 경로와 나중에 오는 partialCancelled 통보가 겹쳐도 1회 — 마이그레이션 없음).
 * 순서: 조각 insert(무효라 배제 제약 밖) → P 끝 줄이기 → 당기기(오름차순) → 구독. 조각을 먼저 쓰므로 그 뒤에서 끊기면 재시도는
 *   'duplicate' 로 멈추고 덜 줄어든 채(사용자 쪽 이득) 남는다 — throw 는 호출부가 last_error·운영 메일로 드러낸다.
 * 반환: 'applied' · 'duplicate'(이 취소 거래를 이미 적용) · 'missing'(살아 있는 P 없음) · 'full'(남는 길이 ≤ 0 — 아무것도 안 바꿨다, 호출부가 전액 환불로).
 * ponytail: 같은 취소 거래를 동시에(ms 단위로 겹쳐) 적용하면 둘 다 조각을 못 보고 두 번 당길 수 있다 — 원자 RPC 로 옮길 때 같이(위 원장 머리말과 같은 한계).
 */
export async function partialRefundMembershipPeriod(
  userId: string,
  orderId: string,
  options: { cancelTid: string; refundAmount: number; orderAmount: number; now?: Date; service?: SupabaseClient }
): Promise<'applied' | 'duplicate' | 'missing' | 'full'> {
  if (!options.cancelTid || !(options.refundAmount > 0) || !(options.orderAmount > 0)) {
    throw new Error('일부 환불 입력이 올바르지 않습니다(취소 거래·금액)');
  }
  const client = options.service ?? (await createServiceClient());
  const now = options.now ?? new Date();
  const t = now.getTime();
  const marker = partialRefundMarker(options.cancelTid);
  const rows = await userPeriods(client, userId, orderId);
  if (rows.some((row) => row.void_reason === marker)) return 'duplicate';
  const period = rows.find((row) => row.voided_at == null);
  if (!period) return 'missing';

  const start = ms(period.start_at);
  const end = ms(period.end_at);
  const k = Math.round((MEMBERSHIP_PERIOD_DAYS * 86_400_000 * options.refundAmount) / options.orderAmount);
  const newEnd = end - k;
  if (newEnd <= start) return 'full';

  const { error } = await client.from('membership_periods').insert({
    user_id: userId,
    source: 'payment',
    order_id: orderId,
    start_at: iso(newEnd),
    end_at: iso(end),
    voided_at: now.toISOString(),
    void_reason: marker,
  });
  if (error) throw new Error(error.message);
  await updatePeriod(client, period.id, { end_at: iso(newEnd) });
  await pullLaterAndSyncSubscription(client, userId, end, Math.max(0, end - Math.max(newEnd, t)), now);
  return 'applied';
}

/** created_at(ISO) → KST 날짜 'YYYY-MM-DD'. 한국은 DST 가 없어 +9h 고정. */
const kstDayOf = (value: string) => new Date(Date.parse(value) + 9 * 3_600_000).toISOString().slice(0, 10);
/** KST 날짜 'YYYY-MM-DD' 의 시작 시각(ISO). */
const kstDayStart = (day: string) => new Date(`${day}T00:00:00+09:00`).toISOString();
type LockedAccessRow = { id: string; feature: string; created_at: string; metadata: Record<string, unknown> | null };
type LockRange = { start: string; end: string };
const PAGE = 1000; // PostgREST 기본 max-rows
const ID_CHUNK = 100; // .in('id', …) 는 URL 에 실린다 — uuid 100개 ≈ 4KB
type PageQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  order(column: string, options: { ascending: boolean }): PageQuery;
  range(from: number, to: number): PageQuery;
};
/** 끝까지 페이지로 읽는다(PostgREST 1000행 절단 방지). created_at·id(유일 키)로 안정 정렬 — 없으면 페이지가 행을 건너뛰거나 겹친다. */
async function readAllPages<T>(query: () => PageQuery): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await query()
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/**
 * 멤버십 전액·일부 환불 — 그 결제 기간에 **멤버십 혜택으로 연** 달력(월)·상세풀이(일) 열람을 지운다(2026-09-14 사용자 결정).
 * 창은 표(membership_periods)의 이 주문 무효 행 그대로 = [start_at, min(end_at, voided_at)) — 환불(무효) 시각까지 이 결제가 쓴 시간.
 *   일부 환불은 잘린 조각이 무효 행이라 창 = [newEnd, min(e, t)) — 줄어든 뒤쪽 날짜에 연 것만(연산 4).
 *   살아 있는 기간은 겹치지 않는 사슬이라 다른 결제·관리자 부여 창과 겹치지 않는다 → 지급 때 추정한 창·"구독 끝과 같은가"·
 *   "다른 주문이 같은 끝을 기록했나" 휴리스틱은 삭제(2026-09-14 원장). 관리자 해제로 무효된 미래 기간은 창이 비어 잠글 게 없다.
 * 감사 먼저(write-ahead): ① 지울 열람 행·스냅샷을 **읽어** 식별자 계산 → ② 감사행 insert(실패하면 아무것도 안 지운다)
 *   → ③ 스냅샷 삭제 → ④ 열람 행 삭제. 어디서 끊겨도 식별자가 남고, 재실행은 표로 같은 창을 다시 계산해 남은 것만 지운다.
 * 스냅샷(/today-fortune/snapshots/[id]·/my/results 는 권한 검사 없이 보여준다)은 **날 단위** — 잠글 상세 행의 KST 날짜 중 그날 다른
 *   열람 근거(표식 없는 상세 행 = 전 결제·쿠폰·레거시, 그날 today-detail 카드 이용권)가 없는 날의 스냅샷을 창 안에서 지운다.
 *   주제 단품(재물·일, 전역) 보유자의 그 주제 스냅샷은 남긴다. 카카오 쿠폰 등 표식 없는 0원 행은 보존.
 * 🔴 무효 표시가 아니라 삭제 — unlock_credit_feature_once 는 행이 남아 있으면 reused(무과금)로 다시 연다.
 * 원장 전이(markPaymentOrderRefunded)가 refundMembershipPeriod 뒤에 부른다. DB 오류는 던진다 — 호출부가 흔적을 남긴다.
 */
export async function lockMembershipContentForRefund(
  userId: string,
  orderId: string,
  options: { reason: string; actor?: string | null; paymentKey?: string | null; now?: Date },
  service?: SupabaseClient
): Promise<{ accessDeleted: number; snapshotsDeleted: number }> {
  if (!userId) throw new Error('사용자 없이 열람을 지우지 않는다');
  const now = options.now ?? new Date();
  const client = service ?? (await createServiceClient());
  // 감사 1행(revokeEntitlementsOfPayment 와 같은 feature). write-ahead 라 실패하면 던진다(지우기 전에 멈춘다).
  const audit = async (metadata: Record<string, unknown>) => {
    const { error } = await client.from('credit_transactions').insert({
      user_id: userId,
      amount: 0,
      type: 'purchase',
      feature: 'entitlement_revoke',
      metadata: {
        ...metadata,
        orderId,
        reason: options.reason,
        actor: options.actor ?? null,
        paymentKey: options.paymentKey ?? null,
        lockedAt: now.toISOString(),
      },
    });
    if (error) throw new Error(error.message);
  };
  const skip = async (skipReason: string, extra: Record<string, unknown> = {}) => {
    // 조용히 넘기지 않고 사유를 남긴다(수동 확인 대상). 실패가 아니라 last_error 는 아니다.
    await audit({ kind: 'membership_content_lock_skipped', skipReason, ...extra });
    return { accessDeleted: 0, snapshotsDeleted: 0 };
  };

  // 표에 무효된 이 주문 기간이 없다 — 086 이전 지급(창을 모른다)·환불 연산 실패.
  const voided = (await userPeriods(client, userId, orderId)).filter((row) => row.voided_at != null);
  if (voided.length === 0) return skip('no_refunded_period');
  const ranges: LockRange[] = voided
    .map((row) => ({ start: ms(row.start_at), end: Math.min(ms(row.end_at), ms(row.voided_at!)) }))
    .filter((w) => w.start < w.end)
    .map((w) => ({ start: iso(w.start), end: iso(w.end) }));
  // 시작 전에 환불(연속 결제의 뒤 결제 — 지금까지 연 건 앞 결제 몫)·관리자 해제로 무효된 미래 기간.
  if (ranges.length === 0) {
    return skip('no_elapsed_window', {
      periods: voided.map((row) => ({ start: row.start_at, end: row.end_at, voidedAt: row.voided_at })),
    });
  }

  // ① 읽기만 — 지울 열람 행, 잠글 날(창별), 다른 근거, 지울 스냅샷.
  const access: LockedAccessRow[] = [];
  const lockDaysByRange: Array<Set<string>> = [];
  for (const range of ranges) {
    const rows = await readAllPages<LockedAccessRow>(() =>
      client
        .from('credit_transactions')
        .select('id, feature, created_at, metadata')
        .eq('user_id', userId)
        .eq('type', 'use')
        .in('feature', ['calendar', 'detail_report'])
        .contains('metadata', { via: 'membership' })
        .gte('created_at', range.start)
        .lt('created_at', range.end)
    );
    access.push(...rows);
    lockDaysByRange.push(new Set(rows.filter((r) => r.feature === 'detail_report').map((r) => kstDayOf(r.created_at))));
  }
  const allDays = lockDaysByRange.flatMap((days) => [...days]).sort();
  const evidence = allDays.length > 0 ? await loadOtherTodayDetailEvidence(client, userId, allDays[0], allDays[allDays.length - 1]) : null;

  // 스냅샷 — 창 안에서 만든 것만(끝 이후 = 다음 기간 몫).
  const snapshots: Array<{ id: string; scope_key: string }> = [];
  for (const [index, range] of ranges.entries()) {
    const days = [...lockDaysByRange[index]].filter((day) => !evidence!.days.has(day));
    if (days.length === 0) continue;
    let query = client
      .from('today_fortune_result_snapshots')
      .select('id, scope_key')
      .eq('user_id', userId)
      .in('occurred_on', days)
      .gte('created_at', range.start)
      .lt('created_at', range.end);
    if (evidence!.topicConcerns.length > 0) query = query.not('concern_id', 'in', `(${evidence!.topicConcerns.join(',')})`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    snapshots.push(...((data ?? []) as Array<{ id: string; scope_key: string }>));
  }

  // ② 감사 먼저 — 지울 것의 식별자(선례 revokeEntitlementsOfPayment 수준). 이름 등 원문은 넣지 않는다 — readingKey 는 이름 해시만 담는다.
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

  // ③ 스냅샷 → ④ 열람 행. ①에서 읽은 id 만(사이에 생긴 행을 계산 없이 지우지 않는다). 열람 행이 남아 있어야 재실행이 잠글 날을 다시 구한다.
  const deleteIds = async (table: string, idList: string[]) => {
    let deleted = 0;
    for (let i = 0; i < idList.length; i += ID_CHUNK) {
      const { data, error } = await client
        .from(table)
        .delete()
        .eq('user_id', userId)
        .in('id', idList.slice(i, i + ID_CHUNK))
        .select('id');
      if (error) throw new Error(error.message);
      deleted += (data ?? []).length;
    }
    return deleted;
  };
  const snapshotsDeleted = await deleteIds('today_fortune_result_snapshots', snapshots.map((row) => row.id));
  const accessDeleted = await deleteIds('credit_transactions', access.map((row) => row.id));
  return { accessDeleted, snapshotsDeleted };
}

/**
 * 멤버십 말고 그 사용자가 오늘 상세를 열 수 있던 근거 — ①표식 없는 상세 열람 행(전 결제 charged·카카오 쿠폰 0원·레거시)의 KST 날짜
 * ②today-detail 카드 이용권의 KST 날짜(hasTodayDetailEntitlementForDay 와 같은 기준) ③보유한 주제 단품(전역)이 여는 주제.
 * ①은 잠글 날 범위(firstDay~lastDay, KST)로 좁혀 페이지 단위로 읽는다(readAllPages).
 * 멤버십 행(창 밖 포함)은 via 로 거른다 — 근거가 아니다.
 * ③은 이용권 행(범위 무관 — 게이트의 전역 판정보다 넓게 남긴다) + 앱 게이트(getTasteProductEntitlement)의 레거시 전 구매 판정 그대로.
 */
async function loadOtherTodayDetailEvidence(client: SupabaseClient, userId: string, firstDay: string, lastDay: string) {
  const from = kstDayStart(firstDay);
  const until = new Date(Date.parse(kstDayStart(lastDay)) + 24 * 3_600_000).toISOString();
  const detailRows = await readAllPages<{ created_at: string; metadata: Record<string, unknown> | null }>(() =>
    client
      .from('credit_transactions')
      .select('created_at, metadata')
      .eq('user_id', userId)
      .eq('type', 'use')
      .eq('feature', 'detail_report')
      .gte('created_at', from)
      .lt('created_at', until)
  );
  const { data: productRows, error: productError } = await client
    .from('product_entitlements')
    .select('product_id, created_at')
    .eq('user_id', userId)
    .in('product_id', ['today-detail', ...Object.values(TOPIC_PRODUCT_BY_CONCERN)]);
  if (productError) throw new Error(productError.message);

  const products = (productRows ?? []) as Array<{ product_id: string; created_at: string }>;
  const days = new Set([
    ...detailRows.filter((row) => row.metadata?.via !== 'membership').map((row) => kstDayOf(row.created_at)),
    ...products.filter((row) => row.product_id === 'today-detail').map((row) => kstDayOf(row.created_at)),
  ]);
  const held = new Set(products.map((row) => row.product_id));
  // 동적 import — 정적이면 순환(product-entitlements → product-scope → credits/detail-report-access → subscription).
  const { getLegacyTasteProductEntitlement } = await import('@/lib/product-entitlements');
  for (const productId of Object.values(TOPIC_PRODUCT_BY_CONCERN)) {
    if (!held.has(productId) && (await getLegacyTasteProductEntitlement(userId, productId as TasteProductId, null, client))) {
      held.add(productId);
    }
  }
  const topicConcerns = Object.entries(TOPIC_PRODUCT_BY_CONCERN)
    .filter(([, productId]) => held.has(productId))
    .map(([concern]) => concern);
  return { days, topicConcerns };
}

/** 관리자 멤버십 해제 — 혜택을 **지금** 끊는다(#821). cancelled 는 renews_at 까지 권한이 남고(isEntitledStatus) 사용자가 재개할 수 있어 해제가 안 됐다.
 *  표(설계 연산 3): 진행 중 기간은 지금에서 끝, 미래 기간은 무효(admin_revoke) — 해제 뒤 재구매는 지금부터 새로 붙고,
 *  옛 주문 환불은 자기 창(해제 시각까지)만 잠근다. 구독 expired + renews_at 지금(남기면 재구매 때 activate 의 base 로 되살아난다).
 *  오류로 끝나면(관리자 화면에 500) 다시 해제한다 — 재실행이 구독을 맞춘다. 진행 중 기간만 자르고 끊긴 채 부여·결제가 먼저 오면
 *  무효 행이 없어 activate 자가치유가 남은 구독 끝을 legacy 로 되살린다. */
export async function expireMembershipNow(userId: string, options: { now?: Date; service?: SupabaseClient } = {}) {
  const client = options.service ?? (await createServiceClient());
  const now = options.now ?? new Date();
  await cutLivePeriodsAt(client, userId, now.getTime(), now, 'admin_revoke');
  await updateSubscriptionEnd(client, userId, now.getTime(), true, now);
}

/**
 * 멤버십 지급(설계 연산 1) — 결제(orderId)면 source 'payment', 없으면 관리자 부여('admin_grant').
 * 기간 [base, base+days) 를 사슬 끝에 붙이고 구독을 그 끝으로. base = max(지금, 살아 있는 끝).
 * 상향 자가치유: 구독 renews_at 이 max(지금, 살아 있는 끝)보다 뒤면 그 틈을 legacy 행으로 먼저 메운다(→ base = renews_at) — 표가 추적 못 한 시간
 *   (086 적용~배포 사이 옛 코드 지급). base 만 올리면 이 결제 환불 때 구독이 사슬 끝으로 내려가 그 시간이 사라진다.
 *   단 그 사용자에게 무효 행이 있으면 치유하지 않고 표를 믿는다(찢긴 환불·해제 — 이 지급이 구독을 표 끝으로 되돌린다).
 *   하향(renews_at < 살아 있는 끝)은 흡수하지 않는다 — 찢긴 지급(행만 쓰고 구독 갱신 실패)과 구별이 안 돼 유료 행을 지울 수 있다(086 드리프트 쿼리로 막는다).
 * 같은 결제의 기간 행이 이미 있으면(지급 재시도) 새 행·연장 없음 → granted false(+60 버그 제거). 단 앞 시도가 행만 쓰고
 * 구독 갱신 전에 끊겼으면(구독 끝 < 살아 있는 끝) 구독만 살아 있는 끝으로 맞춘다.
 */
export async function activateMembershipSubscription(
  userId: string,
  options: {
    plan: SubscriptionPlan;
    days?: number;
    customerKey?: string | null;
    billingKey?: string | null;
    /** 결제 지급이면 주문 id — 재시도 판정·환불이 이 행을 찾는다. */
    orderId?: string | null;
    now?: Date;
    service?: SupabaseClient;
  }
): Promise<{ subscription: ManagedSubscription; granted: boolean }> {
  const client = options.service ?? (await createServiceClient());
  const existing = await readSubscription(userId, client);
  const now = options.now ?? new Date();
  const days = options.days ?? MEMBERSHIP_PERIOD_DAYS;
  const rows = await userPeriods(client, userId);
  let end = lastEnd(rows.filter((row) => row.voided_at == null));
  const retried = !!options.orderId && rows.some((row) => row.order_id === options.orderId);

  if (retried) {
    if (end === null || (!!existing?.renews_at && ms(existing.renews_at) >= end)) {
      if (!existing) throw new Error('구독 정보가 없습니다.');
      return { subscription: mapSubscription(existing), granted: false };
    }
  } else {
    const insert = async (source: string, start: number, endAt: number) => {
      const { error } = await client
        .from('membership_periods')
        .insert({ user_id: userId, source, order_id: source === 'payment' ? options.orderId : null, start_at: iso(start), end_at: iso(endAt) });
      if (error) throw new Error(error.message);
    };
    const tail = Math.max(now.getTime(), end ?? 0);
    // 무효 행이 있으면 치유하지 않는다 — 찢긴 환불·해제(표는 고쳤고 구독 갱신만 실패)의 남은 구독 끝을 legacy 로 굳혀 그 기간을 되살린다.
    //   무효 행은 새 코드의 환불·해제만 만들고 옛 코드 지급 틈은 그 전에 생긴다(②~④ 사이 환불·해제 금지) — 정당한 치유는 잃지 않는다.
    const renews = existing?.renews_at && !rows.some((row) => row.voided_at != null) ? ms(existing.renews_at) : 0;
    if (renews > tail) await insert('legacy', tail, renews);
    const base = Math.max(tail, renews);
    end = ms(addDays(new Date(base), days));
    await insert(options.orderId ? 'payment' : 'admin_grant', base, end);
  }

  const { data, error } = await client
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        status: 'active',
        plan: options.plan,
        renews_at: iso(end),
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

  return { subscription: mapSubscription(data as SubscriptionRow), granted: !retried };
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
