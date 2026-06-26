import { createHash, randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { PaymentPackage } from '@/lib/payments/catalog';
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
  | 'expired';

export type PaymentOrderSource =
  | 'prepare'
  | 'confirm'
  | 'webhook'
  | 'reconciliation'
  | 'nicepay-return'; // 2026-06-26 나이스페이 서버승인 returnUrl 핸들러

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
  lastError: string | null;
  fulfillmentAttempts: number;
  reconciliationAttempts: number;
  expiresAt: string;
  confirmedAt: string | null;
  fulfilledAt: string | null;
  failedAt: string | null;
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
    lastError: readString(row.last_error),
    fulfillmentAttempts: readNumber(row.fulfillment_attempts),
    reconciliationAttempts: readNumber(row.reconciliation_attempts),
    expiresAt: readString(row.expires_at) ?? '',
    confirmedAt: readString(row.confirmed_at),
    fulfilledAt: readString(row.fulfilled_at),
    failedAt: readString(row.failed_at),
    lastReconciledAt: readString(row.last_reconciled_at),
    createdAt: readString(row.created_at) ?? '',
    updatedAt: readString(row.updated_at) ?? '',
  };
}

export async function createPaymentOrder(input: {
  userId: string;
  pkg: PaymentPackage;
  slug?: string | null;
  scope?: string | null;
  product?: string | null;
  plan?: string | null;
  entrySource?: string | null;
  paymentMethodCode?: string | null;
  acceptedKinds: PolicyKind[];
  recordedPolicyVersionIds: string[];
  metadata?: Record<string, unknown>;
}) {
  const service = await createServiceClient();
  const orderId = generatePaymentOrderId();
  const { data, error } = await service
    .from('payment_orders')
    .insert({
      order_id: orderId,
      user_id: input.userId,
      package_id: input.pkg.id,
      amount: input.pkg.price,
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

export async function getPaymentOrderByOrderId(orderId: string) {
  const service = await createServiceClient();
  const { data, error } = await service
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

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }

  return error?.code === '23505' ? 'duplicate' : 'inserted';
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
