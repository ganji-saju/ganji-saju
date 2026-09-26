import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { applyCouponDiscount } from '@/lib/coupons/discount-coupon';
import { dispatchGaRefund } from '@/lib/analytics/ga-purchase-dispatch';
import { getPackage, type PaymentPackage } from '@/lib/payments/catalog';
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import { isPgFullyCancelled } from '@/lib/payments/nicepay';
import { partialRefundsOf } from '@/lib/payments/cancellation';
import { lockMembershipContentForRefund, partialRefundMembershipPeriod, refundMembershipPeriod } from '@/lib/subscription';
import type { PolicyKind } from '@/shared/policies/types';

export type PaymentOrderStatus =
  | 'prepared'
  | 'in_progress'
  | 'confirmed'
  | 'fulfilling'
  | 'fulfilled'
  | 'payment_failed'
  | 'fulfillment_failed'
  | 'canceled'
  | 'refunded'
  | 'expired';

export type PaymentOrderSource =
  | 'prepare'
  | 'confirm'
  | 'webhook'
  | 'reconciliation'
  | 'nicepay-return' // 2026-06-26 나이스페이 서버승인 returnUrl 핸들러
  | 'admin-refund'; // 2026-07-13 관리자 환불 승인 시 원주문 refunded 표기

export interface TossPaymentObject {
  paymentKey?: string | null;
  orderId?: string | null;
  status?: string | null;
  totalAmount?: number | null;
  amount?: number | null;
  currency?: string | null;
  method?: string | null;
  approvedAt?: string | null;
  requestedAt?: string | null;
  [key: string]: unknown;
}

export interface PaymentOrder {
  id: string;
  orderId: string;
  userId: string;
  packageId: string;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  paymentKey: string | null;
  tossStatus: string | null;
  tossPayment: TossPaymentObject | null;
  slug: string | null;
  scope: string | null;
  product: string | null;
  plan: string | null;
  entrySource: string | null;
  paymentMethodCode: string | null;
  acceptedPolicyKinds: string[];
  recordedPolicyVersionIds: string[];
  metadata: Record<string, unknown>;
  /** 할인 주문이면 귀속된 쿠폰(정규형). 승인 직전 재검증(coupon-order-guard)이 본다. */
  couponCode: string | null;
  /** 할인 주문의 정가·할인액 스냅샷(079). 승인 직전 관문이 소급 인하 뒤 옛 할인가 주문을 가려낸다(PR6). 정가 기록 없는 옛 주문은 null. */
  listAmount: number | null;
  discountWon: number;
  lastError: string | null;
  fulfillmentAttempts: number;
  reconciliationAttempts: number;
  expiresAt: string;
  confirmedAt: string | null;
  fulfilledAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  lastReconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type PaymentOrderRow = Record<string, unknown>;

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function generatePaymentOrderId() {
  return `ord_${randomUUID()}`;
}

export function isValidServerOrderId(orderId: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(orderId);
}

export function getTossPaymentAmount(payment: TossPaymentObject) {
  if (typeof payment.totalAmount === 'number' && Number.isFinite(payment.totalAmount)) {
    return payment.totalAmount;
  }
  if (typeof payment.amount === 'number' && Number.isFinite(payment.amount)) {
    return payment.amount;
  }
  return null;
}

export function normalizeTossPayment(value: unknown): TossPaymentObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as TossPaymentObject;
}

export function validateTossPaymentAgainstOrder(
  order: Pick<PaymentOrder, 'orderId' | 'amount' | 'currency'>,
  payment: TossPaymentObject
): { ok: true } | { ok: false; error: string } {
  if (payment.orderId !== order.orderId) {
    return { ok: false, error: 'Toss 결제 주문번호가 내부 주문과 일치하지 않습니다.' };
  }

  const amount = getTossPaymentAmount(payment);
  if (amount !== order.amount) {
    return { ok: false, error: 'Toss 결제 금액이 내부 주문 금액과 일치하지 않습니다.' };
  }

  if (payment.currency && payment.currency !== order.currency) {
    return { ok: false, error: 'Toss 결제 통화가 내부 주문 통화와 일치하지 않습니다.' };
  }

  return { ok: true };
}

function mapPaymentOrder(row: PaymentOrderRow): PaymentOrder {
  return {
    id: readString(row.id) ?? '',
    orderId: readString(row.order_id) ?? '',
    userId: readString(row.user_id) ?? '',
    packageId: readString(row.package_id) ?? '',
    amount: readNumber(row.amount),
    currency: readString(row.currency) ?? 'KRW',
    status: (readString(row.status) ?? 'prepared') as PaymentOrderStatus,
    paymentKey: readString(row.payment_key),
    tossStatus: readString(row.toss_status),
    tossPayment: normalizeTossPayment(row.toss_payment),
    slug: readString(row.slug),
    scope: readString(row.scope),
    product: readString(row.product),
    plan: readString(row.plan),
    entrySource: readString(row.entry_source),
    paymentMethodCode: readString(row.payment_method_code),
    acceptedPolicyKinds: readStringArray(row.accepted_policy_kinds),
    recordedPolicyVersionIds: readStringArray(row.recorded_policy_version_ids),
    metadata: readObject(row.metadata),
    couponCode: readString(row.coupon_code),
    listAmount: typeof row.list_amount === 'number' && Number.isFinite(row.list_amount) ? row.list_amount : null,
    discountWon: readNumber(row.discount_won),
    lastError: readString(row.last_error),
    fulfillmentAttempts: readNumber(row.fulfillment_attempts),
    reconciliationAttempts: readNumber(row.reconciliation_attempts),
    expiresAt: readString(row.expires_at) ?? '',
    confirmedAt: readString(row.confirmed_at),
    fulfilledAt: readString(row.fulfilled_at),
    failedAt: readString(row.failed_at),
    refundedAt: readString(row.refunded_at),
    lastReconciledAt: readString(row.last_reconciled_at),
    createdAt: readString(row.created_at) ?? '',
    updatedAt: readString(row.updated_at) ?? '',
  };
}

export async function createPaymentOrder(
  input: {
    userId: string;
    pkg: PaymentPackage;
    /**
     * 🔴 2026-09-11 — `amount` 에서 이름을 바꿨다. **정가**(리졸버 스냅샷가, 카탈로그 price 아님).
     *   할인 계산은 이 함수 **안에서** 한다 → 새 결제 경로를 만드는 사람은 정가를 넘길 수밖에 없고
     *   할인이 자동으로 붙는다. "쿠폰 적용을 잊는다"는 실수의 물리적 표현이 사라진다.
     *   설계: docs/discount-coupon-design.md §3-1
     */
    listAmount: number;
    /**
     * 적용할 쿠폰. null = 쿠폰 없음(할인 0). prepare 가 귀속·검증을 마친 뒤 넘긴다.
     * ⚠️ 클라이언트가 보낸 값을 그대로 넘기면 안 된다 — percent 는 반드시 DB(coupon_tiers)에서 읽은 값.
     */
    coupon?: { code: string; percent: number; maxDiscountWon?: number | null } | null;
    /** 2026-09-26 — 멤버십 할인율(서버 판정값 ChargeQuote.memberPercent 만). coupon 과 동시에 오지 않는다. */
    memberPercent?: number;
    slug?: string | null;
    scope?: string | null;
    product?: string | null;
    plan?: string | null;
    entrySource?: string | null;
    paymentMethodCode?: string | null;
    acceptedKinds: PolicyKind[];
    recordedPolicyVersionIds: string[];
    metadata?: Record<string, unknown>;
    /** 2026-08-26 — 결제 확정(서버)이 원래 세션·채널에 귀속되도록 시작 시점에 스냅샷. */
    gaClientId?: string | null;
    gaSessionId?: string | null;
    /** 분석 동의 상태. 'denied' 면 확정 시 GA 전송을 건너뛴다(Consent Mode 우회 금지). */
    analyticsConsent?: string | null;
  },
  service?: SupabaseClient
) {
  const client = service ?? (await createServiceClient());
  const orderId = generatePaymentOrderId();
  // 🔴 할인이 금액이 되는 유일한 지점. 상한 50% clamp·원 단위 절사·0원 방지가 여기 들어 있다.
  //   호출부가 할인을 계산해 넘기는 구조였다면 경로마다 어긋났을 것이다.
  const pricing = input.coupon
    ? applyCouponDiscount(input.listAmount, input.coupon.percent, input.coupon.maxDiscountWon)
    : input.memberPercent
      ? applyCouponDiscount(input.listAmount, input.memberPercent, null)
      : { percent: 0, discountWon: 0, chargeAmount: input.listAmount };
  const { data, error } = await client
    .from('payment_orders')
    .insert({
      order_id: orderId,
      user_id: input.userId,
      package_id: input.pkg.id,
      // amount = **실청구액**. 의미를 바꾸지 않는다 — 승인 대조·환불·매출집계가 전부 이 값을 본다.
      amount: pricing.chargeAmount,
      list_amount: input.listAmount,
      discount_won: pricing.discountWon,
      coupon_code: input.coupon?.code ?? null,
      coupon_percent: input.coupon ? pricing.percent : null,
      currency: 'KRW',
      status: 'prepared',
      slug: input.slug ?? null,
      scope: input.scope ?? null,
      product: input.product ?? null,
      plan: input.plan ?? null,
      entry_source: input.entrySource ?? null,
      payment_method_code: input.paymentMethodCode ?? null,
      accepted_policy_kinds: input.acceptedKinds,
      recorded_policy_version_ids: input.recordedPolicyVersionIds,
      ga_client_id: input.gaClientId ?? null,
      ga_session_id: input.gaSessionId ?? null,
      analytics_consent: input.analyticsConsent ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '결제 주문을 만들지 못했습니다.');
  }

  return mapPaymentOrder(data as PaymentOrderRow);
}

export async function updatePaymentOrderPolicyVersions(orderId: string, policyVersionIds: string[]) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('payment_orders')
    .update({
      recorded_policy_version_ids: policyVersionIds,
    })
    .eq('order_id', orderId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '결제 주문 동의 이력을 갱신하지 못했습니다.');
  }

  return mapPaymentOrder(data as PaymentOrderRow);
}

export async function getPaymentOrderByOrderId(orderId: string, service?: SupabaseClient) {
  const client = service ?? (await createServiceClient());
  const { data, error } = await client
    .from('payment_orders')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapPaymentOrder(data as PaymentOrderRow) : null;
}

// 2026-06-26 — 환불 시 PG 분기용. order metadata.provider 로 toss/nicepay 판별(없으면 toss).
export async function getOrderProviderByPaymentKey(
  paymentKey: string
): Promise<'toss' | 'nicepay'> {
  const service = await createServiceClient();
  const { data } = await service
    .from('payment_orders')
    .select('metadata')
    .eq('payment_key', paymentKey)
    .maybeSingle();
  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  return metadata?.provider === 'nicepay' ? 'nicepay' : 'toss';
}

export async function getPaymentOrderForUser(orderId: string, userId: string) {
  const order = await getPaymentOrderByOrderId(orderId);
  if (!order || order.userId !== userId) return null;
  return order;
}

/** payment_key 로 주문 로드(환불 완료 시 원주문 status 갱신 · 나이스 통보는 tid 로 주문을 찾는다). DB 오류는 던진다(통보 재전송으로 복구). */
export async function getPaymentOrderByPaymentKey(
  paymentKey: string,
  service?: SupabaseClient
): Promise<PaymentOrder | null> {
  const client = service ?? (await createServiceClient());
  const { data, error } = await client
    .from('payment_orders')
    .select('*')
    .eq('payment_key', paymentKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPaymentOrder(data as PaymentOrderRow) : null;
}

export async function attachPaymentKeyToOrder(input: {
  order: PaymentOrder;
  paymentKey: string;
  source: PaymentOrderSource;
}) {
  if (input.order.paymentKey && input.order.paymentKey !== input.paymentKey) {
    throw new Error('이미 다른 Toss 결제 키가 연결된 주문입니다.');
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from('payment_orders')
    .update({
      status: input.order.status === 'prepared' ? 'in_progress' : input.order.status,
      payment_key: input.paymentKey,
      metadata: {
        ...input.order.metadata,
        lastPaymentKeySource: input.source,
      },
    })
    .eq('order_id', input.order.orderId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '결제 키를 주문에 연결하지 못했습니다.');
  }

  return mapPaymentOrder(data as PaymentOrderRow);
}

export async function markPaymentOrderConfirmed(input: {
  orderId: string;
  payment: TossPaymentObject;
  source: PaymentOrderSource;
}) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('payment_orders')
    .update({
      status: 'confirmed',
      payment_key: input.payment.paymentKey ?? null,
      toss_status: input.payment.status ?? null,
      toss_payment: input.payment,
      confirmed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('order_id', input.orderId)
    .in('status', ['prepared', 'in_progress', 'confirmed', 'payment_failed', 'fulfillment_failed'])
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const latest = await getPaymentOrderByOrderId(input.orderId);
    if (latest) return latest;
    throw new Error('결제 승인 상태를 저장하지 못했습니다.');
  }

  return mapPaymentOrder(data as PaymentOrderRow);
}

export async function claimPaymentOrderFulfillment(orderId: string) {
  const service = await createServiceClient();
  const { data, error } = await service.rpc('claim_payment_order_fulfillment', {
    p_order_id: orderId,
  });

  if (error) throw new Error(error.message);
  return data ? mapPaymentOrder(data as PaymentOrderRow) : null;
}

export async function markPaymentOrderFulfilled(input: {
  orderId: string;
  payment: TossPaymentObject;
  source: PaymentOrderSource;
}) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('payment_orders')
    .update({
      status: 'fulfilled',
      payment_key: input.payment.paymentKey ?? null,
      toss_status: input.payment.status ?? null,
      toss_payment: input.payment,
      fulfilled_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('order_id', input.orderId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '결제 지급 완료 상태를 저장하지 못했습니다.');
  }

  return mapPaymentOrder(data as PaymentOrderRow);
}

export async function markPaymentOrderFailed(input: {
  orderId: string;
  status: Extract<PaymentOrderStatus, 'payment_failed' | 'fulfillment_failed' | 'canceled' | 'expired'>;
  error: string;
  source: PaymentOrderSource;
  payment?: TossPaymentObject | null;
}) {
  const service = await createServiceClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    toss_status: input.payment?.status ?? null,
    last_error: input.error,
    failed_at: now,
  };
  if (input.payment) {
    patch.toss_payment = input.payment;
  }
  const { data, error } = await service
    .from('payment_orders')
    .update(patch)
    .eq('order_id', input.orderId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '결제 실패 상태를 저장하지 못했습니다.');
  }

  return mapPaymentOrder(data as PaymentOrderRow);
}

/**
 * 2026-08-26 — PG 가 **실제로 취소한 시각**. 환불 귀속일(refunded_at)의 정본이다.
 *
 * 그전엔 항상 `now()` 를 찍었다. 그러면 예전에 PG 에서 취소된 결제를 정산 크론
 * (reconciliation)이나 웹훅 재수신이 **오늘 처음 감지했을 때 그 환불이 오늘로 귀속**되어,
 * 결제가 없던 날에 환불만 꽂히고 순매출이 마이너스가 된다(사용자 제보로 드러난 경로).
 *
 * 취소가 여러 번(부분취소 누적)이면 **가장 마지막** 취소 시각을 쓴다 — 주문이 refunded 로
 * 넘어간 순간이 그때다.
 *
 * ⚠️ 파싱은 보수적으로: `YYYY-MM-DD` 로 시작하는 ISO-8601 형태만 받는다. 나이스페이가
 *   `20260826...` 같은 압축 표기를 줄 때 엔진마다 다르게 해석되는 걸 막는다. 미래 시각도
 *   거부한다(시계 오차·오염된 응답이 지표를 미래로 밀지 않게). 못 믿으면 null → 호출부가 now().
 */
export function resolvePgCancelledAt(
  payment: TossPaymentObject | null | undefined,
  now: Date = new Date()
): string | null {
  if (!payment) return null;

  const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}[T ]/;
  const CANCEL_TIME_KEYS = [
    'canceledAt',
    'cancelledAt',
    'canceledTimestamp',
    'cancelledTimestamp',
  ] as const;

  const parse = (value: unknown): number | null => {
    if (typeof value !== 'string' || !ISO_PREFIX.test(value)) return null;
    const t = Date.parse(value);
    if (!Number.isFinite(t)) return null;
    // 60초 여유 — 서버 간 시계 오차는 허용하되 진짜 미래 값은 버린다.
    if (t > now.getTime() + 60_000) return null;
    return t;
  };

  const candidates: number[] = [];
  const cancels = payment.cancels;
  if (Array.isArray(cancels)) {
    for (const entry of cancels) {
      if (!entry || typeof entry !== 'object') continue;
      for (const key of CANCEL_TIME_KEYS) {
        const t = parse((entry as Record<string, unknown>)[key]);
        if (t != null) candidates.push(t);
      }
    }
  }
  for (const key of CANCEL_TIME_KEYS) {
    const t = parse(payment[key]);
    if (t != null) candidates.push(t);
  }

  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates)).toISOString();
}

/**
 * 2026-07-13 — 결제 성공분의 환불. 'canceled'(결제 전 취소)와 구분해 매출 이력을 보존한다.
 *   결제 시점 amount 는 그대로 두고 status='refunded' + refunded_at 만 기록 →
 *   집계에서 총매출(결제분)과 환불액을 분리해 낼 수 있다.
 */
export async function markPaymentOrderRefunded(input: {
  orderId: string;
  reason: string;
  source: PaymentOrderSource;
  payment?: TossPaymentObject | null;
}, service?: SupabaseClient) {
  const client = service ?? (await createServiceClient());
  const now = new Date();
  // 2026-08-26 — 귀속일은 **PG 가 실제로 취소한 시각**. 못 읽으면 지금(감지 시각)으로 폴백.
  //   항상 now() 를 쓰면 뒤늦게 감지된 과거 취소가 오늘 환불로 잡혀 그날 순매출이 마이너스가 된다.
  const refundedAt = resolvePgCancelledAt(input.payment, now) ?? now.toISOString();
  const patch: Record<string, unknown> = {
    status: 'refunded',
    last_error: input.reason,
    refunded_at: refundedAt,
  };
  if (input.payment) {
    patch.toss_status = input.payment.status ?? null;
    patch.toss_payment = input.payment;
  }
  // 멱등: 이미 refunded 인 주문은 다시 스탬프하지 않는다(neq 로 제외). 재호출(관리자 재승인·
  //   통보 재수신)마다 refunded_at 을 now 로 덮으면 환불 귀속일이 미래로 드리프트해 마감된
  //   과거 지표가 사후에 바뀐다. 최초 1회만 stamp 하고, 이미 refunded 면 기존 행을 반환한다.
  const { data, error } = await client
    .from('payment_orders')
    .update(patch)
    .eq('order_id', input.orderId)
    .neq('status', 'refunded')
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? '환불 상태를 저장하지 못했습니다.');
  }
  if (data) {
    const order = mapPaymentOrder(data as PaymentOrderRow);
    // 2026-08-26 — GA4 refund. 원거래와 같은 transaction_id 로 보내야 그 거래의 매출이
    //   차감된다. 여기(원장 함수)에 두면 admin·웹훅·정산 세 경로가 한 번에 커버된다.
    //   ⚠️ 방금 refunded 로 바뀐 경우에만 — 멱등 재호출은 위 neq 가드로 여기 안 온다.
    await dispatchGaRefund(order.orderId, order.amount).catch(() => undefined);
    // 멤버십 전액환불 — 여기(방금 refunded 로 바뀐 분기)라 관리자 환불·나이스 통보·정산이 겹쳐도 정확히 1회다.
    //   일부 환불은 이 함수를 부르지 않는다(주문은 결제 상태 그대로) — applyPartialRefund.
    if (getPackage(order.packageId)?.kind === 'subscription') {
      await refundMembershipLedger(client, order, input.reason, input.source);
    }
    return order;
  }

  // 갱신된 행이 없음 = 이미 refunded(멱등 재호출). 기존 행을 그대로 반환.
  const existing = await getPaymentOrderByOrderId(input.orderId, client);
  if (!existing) {
    throw new Error('환불 상태를 저장하지 못했습니다.');
  }
  return existing;
}

/**
 * 멤버십 전액환불의 원장 쪽 — ① 기간 원장(이 결제 기간 무효 + 뒤 기간 당기기 + 구독 끝) ② 그 창에 멤버십으로 연 달력·상세 잠금.
 *   주문 표기·GA 는 하지 않는다(호출부 몫) — 일부 환불로 남는 길이가 0 이 됐는데 PG 잔액은 남은 경우(applyPartialRefund 'full')도 이것만 부른다.
 *   실패는 삼키지 않고 주문 last_error(이어 붙임)·운영 메일로 드러낸다 — 전이는 이미 끝나 재호출이 다시 하지 않는다(수동 보정 대상).
 */
async function refundMembershipLedger(client: SupabaseClient, order: PaymentOrder, reason: string, source: PaymentOrderSource) {
  const failures: string[] = [];
  const note = (label: string) => (err: unknown) => {
    const message = `${label}: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[refund] 멤버십 환불 후처리 실패', { orderId: order.orderId, message });
    failures.push(message);
  };
  // ① 기간 원장(membership_periods). 정본은 표 하나(#820 일수 차감 폴백 삭제).
  //    지급된 주문인데 표에 없으면(086 적용~배포 사이 옛 코드 지급 등) 구독을 추정으로 깎지 않고 드러낸다 — 수동 차감. ②는 skip 감사.
  const inLedger = await refundMembershipPeriod(order.userId, order.orderId, { service: client }).catch((err) => {
    note('membership_shorten_failed')(err);
    return true; // 실패는 이미 기록했다 — '표에 없음'으로 겹쳐 적지 않는다
  });
  if (!inLedger && order.fulfilledAt) {
    failures.push(
      'membership_period_missing: 표에 이 결제 기간 없음 — 구독 renews_at 과 그 몫을 덮은 legacy 행(백필·자가치유)을 같이 줄이고 뒤 행은 당긴 뒤 086 드리프트 쿼리 0 확인'
    );
  }
  // ② 그 결제 기간(표의 무효 행 창)에 멤버십으로 연 달력·상세풀이 잠금. 감사 먼저라 부분 실패해도 식별자가 남는다.
  await lockMembershipContentForRefund(order.userId, order.orderId, { reason, actor: source, paymentKey: order.paymentKey }, client).catch(
    note('membership_lock_failed')
  );
  await reportMembershipRefundFailures(client, order, reason, failures);
}

/** 멤버십 환불 후처리 실패 → 주문 last_error(환불 사유 뒤로 이어 붙임) + 운영 메일(프로덕션만, 실패 무시). */
async function reportMembershipRefundFailures(client: SupabaseClient, order: PaymentOrder, reason: string, failures: string[]) {
  if (failures.length === 0) return;
  await client
    .from('payment_orders')
    .update({ last_error: [reason, ...failures].join(' | ') })
    .eq('order_id', order.orderId);
  if (process.env.VERCEL_ENV === 'production') {
    await sendOpsAlertEmail({
      subject: '[환불] 멤버십 환불 후처리 실패 — 수동 확인',
      lines: [`주문 ${order.orderId} · 사용자 ${order.userId}`, ...failures, '주문 last_error 와 credit_transactions(entitlement_revoke) 감사행을 확인하세요.'],
      url: '/admin/users',
    }).catch(() => undefined);
  }
}

/**
 * 2026-09-14 — PG 일부 취소 1건(취소 거래 cancelTid, 금액 amount = 나이스 cancels[].amount)의 원장 반영. 관리자 부분취소 경로와 partialCancelled 통보가 같이 부른다.
 *   주문은 결제 상태 그대로 둔다(refunded 표기·이용권 회수·GA 전액 환불 없음). 금액은 metadata.partialRefunds 에 취소 거래 단위로 1회 기록(환불 지표).
 *   멤버십이 아니면 기록만(이용권 유지 — 관리자 부분환불 정책과 대칭).
 *   멤버십이면 연산 4(partialRefundMembershipPeriod — 취소 거래 단위 1회) → 줄어든 뒤쪽 창 잠금. 남는 길이가 없으면('full') 원장만 전액 처리
 *   (무효·당기기·잠금) — 주문 refunded 표기·GA 는 PG 잔액이 실제로 0 일 때만(리뷰: 관리자 해제로 짧아진 P 의 50% 환불이 49,000 전액 환불로 잡혔다).
 *   이미 refunded 인 주문(전액 뒤 늦게 온 일부 통보)은 'skipped' — 전액 전이가 그 돈을 이미 셌다. 원장·잠금 실패는 last_error·운영 메일(전액 경로와 같다).
 *   metadata 기록이 실패하면 던진다(통보는 재전송으로, 관리자 경로는 화면 사유로).
 */
export async function applyPartialRefund(
  input: { orderId: string; cancelTid: string; amount: number; reason: string; source: PaymentOrderSource; payment?: TossPaymentObject | null },
  service?: SupabaseClient
): Promise<'applied' | 'duplicate' | 'missing' | 'voided' | 'full' | 'skipped' | 'failed'> {
  const client = service ?? (await createServiceClient());
  const order = await getPaymentOrderByOrderId(input.orderId, client);
  if (!order) throw new Error(`주문 없음: ${input.orderId}`);
  if (order.status === 'refunded') return 'skipped';

  // 환불 지표용 기록 — 취소 거래 단위 1회. 귀속 시각은 그 취소 건의 PG 시각(통보가 늦게 와도 그날), 못 읽으면 지금.
  // ponytail: metadata 읽고-쓰기라 서로 다른 취소 거래 둘이 같은 순간 기록되면 하나를 덮을 수 있다 — 원자 RPC 로 옮길 때 같이.
  const recorded = partialRefundsOf(order.metadata);
  if (!recorded.some((p) => p.cancelTid === input.cancelTid)) {
    const entry = (Array.isArray(input.payment?.cancels) ? input.payment.cancels : []).find(
      (c) => !!c && typeof c === 'object' && (c as Record<string, unknown>).tid === input.cancelTid
    );
    const at = resolvePgCancelledAt(entry ? ({ cancels: [entry] } as TossPaymentObject) : null) ?? new Date().toISOString();
    const metadata = { ...order.metadata, partialRefunds: [...recorded, { cancelTid: input.cancelTid, amount: input.amount, at }] };
    const { error } = await client.from('payment_orders').update({ metadata }).eq('order_id', order.orderId);
    if (error) throw new Error(error.message);
  }
  if (getPackage(order.packageId)?.kind !== 'subscription') return 'skipped';

  const failures: string[] = [];
  const outcome = await partialRefundMembershipPeriod(order.userId, order.orderId, {
    cancelTid: input.cancelTid,
    refundAmount: input.amount,
    orderAmount: order.amount,
    service: client,
  }).catch((err) => {
    failures.push(`membership_partial_failed: ${err instanceof Error ? err.message : String(err)}`);
    return 'failed' as const;
  });
  if (outcome === 'full') {
    if (isPgFullyCancelled(input.payment)) {
      await markPaymentOrderRefunded({ orderId: order.orderId, reason: input.reason, source: input.source, payment: input.payment }, client);
    } else {
      await refundMembershipLedger(client, order, input.reason, input.source);
    }
    return 'full';
  }
  if (outcome === 'missing' && order.fulfilledAt) {
    failures.push(`membership_period_missing: 표에 이 결제의 살아 있는 기간 없음 — 일부 환불 ${input.amount}원(${input.cancelTid}) 수동 반영`);
  }
  if (outcome === 'applied') {
    await lockMembershipContentForRefund(order.userId, order.orderId, { reason: input.reason, actor: input.source, paymentKey: order.paymentKey }, client).catch(
      (err) => failures.push(`membership_lock_failed: ${err instanceof Error ? err.message : String(err)}`)
    );
  }
  await reportMembershipRefundFailures(client, order, input.reason, failures);
  return outcome;
}

export async function touchPaymentOrderReconciled(orderId: string) {
  const service = await createServiceClient();
  const { data, error } = await service.rpc('mark_payment_order_reconciliation_attempt', {
    p_order_id: orderId,
  });

  if (error) throw new Error(error.message);
  return data ? mapPaymentOrder(data as PaymentOrderRow) : null;
}

export async function listPaymentOrdersForReconciliation(limit = 20) {
  const service = await createServiceClient();
  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data, error } = await service
    .from('payment_orders')
    .select('*')
    .in('status', ['prepared', 'in_progress', 'confirmed', 'fulfillment_failed', 'fulfilling'])
    .lt('updated_at', staleBefore)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapPaymentOrder(row as PaymentOrderRow));
}

export function hashWebhookPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function recordPaymentWebhookEvent(input: {
  payload: Record<string, unknown>;
  eventType: string;
  eventHash: string;
  eventCreatedAt?: string | null;
  orderId?: string | null;
  paymentKey?: string | null;
  paymentStatus?: string | null;
}) {
  const service = await createServiceClient();
  const { error } = await service.from('payment_webhook_events').insert({
    event_hash: input.eventHash,
    event_type: input.eventType,
    event_created_at: input.eventCreatedAt ?? null,
    order_id: input.orderId ?? null,
    payment_key: input.paymentKey ?? null,
    payment_status: input.paymentStatus ?? null,
    raw_payload: input.payload,
  });

  if (!error) return 'inserted';
  if (error.code !== '23505') throw new Error(error.message);

  // 2026-09-14 — 같은 통보가 이미 있다. 끝까지 처리된(processed/ignored) 것만 중복이다.
  //   received(처리 중 죽음)·failed(처리 실패)를 중복으로 흡수하면 재전송이 와도 영구 미처리로 남는다 → 'unfinished'(다시 처리).
  //   위조 가드가 거부한(ignored + forgery_guard:) 통보도 다시 검증한다 — 진짜 취소를 잘못 거부했을 때 원인을 고치고 콘솔 재전송하는 복구 경로.
  const { data, error: readError } = await service
    .from('payment_webhook_events')
    .select('processing_status, error')
    .eq('event_hash', input.eventHash)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const row = data as { processing_status?: unknown; error?: unknown } | null;
  const guarded = typeof row?.error === 'string' && row.error.startsWith('forgery_guard:');
  return row?.processing_status === 'processed' || (row?.processing_status === 'ignored' && !guarded) ? 'duplicate' : 'unfinished';
}

/** 최근 1시간 안에 같은 결제키·같은 사유(error 접두)로 거부된 통보가 있나 — 위조 가드 운영 메일을 tid·사유당 1통으로 줄인다. */
export async function hasRecentWebhookRejection(paymentKey: string, error: string): Promise<boolean> {
  const service = await createServiceClient();
  const { data, error: readError } = await service
    .from('payment_webhook_events')
    .select('event_hash')
    .eq('payment_key', paymentKey)
    .like('error', `${error}%`)
    .gte('processed_at', new Date(Date.now() - 3_600_000).toISOString())
    .limit(1);
  if (readError) return false; // 억제 조회 실패는 메일을 막지 않는다
  return (data ?? []).length > 0;
}

export async function markPaymentWebhookEvent(input: {
  eventHash: string;
  status: 'processed' | 'ignored' | 'failed';
  error?: string | null;
}) {
  const service = await createServiceClient();
  await service
    .from('payment_webhook_events')
    .update({
      processing_status: input.status,
      error: input.error ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('event_hash', input.eventHash);
}
