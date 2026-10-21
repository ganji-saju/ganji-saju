import 'server-only';
import { randomBytes } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { ExternalReportRequest } from '@/lib/admin/external-report';
import { canTransition, type ReportOrderStatus, type ReportPayMethod, type ReportProduct } from './report-order';
import type { ReportOrderInput } from './parse-report-order';

const TABLE = 'report_orders';
const DEPOSIT_DAYS = 3;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PAGE_SIZE = 30;

export interface ReportOrderRow {
  id: string;
  orderNo: string;
  product: ReportProduct;
  amount: number;
  payMethod: ReportPayMethod;
  status: ReportOrderStatus;
  name: string | null;
  phone: string | null;
  email: string | null;
  birth: ExternalReportRequest | null;
  memo: string | null;
  cashReceipt: boolean;
  paymentOrderId: string | null;
  externalReportId: string | null;
  resultToken: string | null;
  depositDueAt: string | null;
  sentAt: string | null;
  sendResult: Record<string, unknown> | null;
  refundNote: string | null;
  purgedAt: string | null;
  createdAt: string;
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : null);

function mapRow(row: Row): ReportOrderRow {
  return {
    id: String(row.id), orderNo: String(row.order_no), product: row.product as ReportProduct,
    amount: Number(row.amount), payMethod: row.pay_method as ReportPayMethod,
    status: row.status as ReportOrderStatus, name: s(row.name), phone: s(row.phone), email: s(row.email),
    birth: (row.birth_input as ExternalReportRequest | null) ?? null, memo: s(row.memo), cashReceipt: row.cash_receipt === true,
    paymentOrderId: s(row.payment_order_id), externalReportId: s(row.external_report_id), resultToken: s(row.result_token),
    depositDueAt: s(row.deposit_due_at), sentAt: s(row.sent_at),
    sendResult: (row.send_result as Record<string, unknown> | null) ?? null, refundNote: s(row.refund_note),
    purgedAt: s(row.purged_at), createdAt: String(row.created_at),
  };
}

function buildOrderNo(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3600_000).toISOString();
  const ymd = kst.slice(2, 4) + kst.slice(5, 7) + kst.slice(8, 10);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const tail = [...randomBytes(4)].map((b) => alphabet[b % alphabet.length]).join('');
  return `GS-R-${ymd}-${tail}`;
}

export async function createReportOrder(
  input: ReportOrderInput & { amount: number; paymentOrderId: string | null; source: string | null },
  opts: { now?: Date } = {},
): Promise<ReportOrderRow> {
  const now = opts.now ?? new Date();
  const service = await createServiceClient();
  const isBank = input.payMethod === 'bank';
  const { data, error } = await service.from(TABLE).insert({
    order_no: buildOrderNo(now),
    product: input.product,
    amount: input.amount,
    pay_method: input.payMethod,
    status: isBank ? 'awaiting_deposit' : 'pending_payment',
    name: input.name,
    phone: input.phone,
    email: input.email,
    birth_input: input.birth,
    memo: input.memo || null,
    cash_receipt: input.cashReceipt,
    payment_order_id: input.paymentOrderId,
    result_token: randomBytes(32).toString('base64url'),
    deposit_due_at: isBank ? new Date(now.getTime() + DEPOSIT_DAYS * 86400_000).toISOString() : null,
    consented_at: now.toISOString(),
    source: input.source,
  }).select('*').single();
  if (error || !data) throw new Error('report_order_create_failed');
  return mapRow(data as Row);
}

export async function getReportOrder(id: string): Promise<ReportOrderRow | null> {
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('report_order_read_failed');
  return data ? mapRow(data as Row) : null;
}

export async function getReportOrderByPaymentOrder(paymentOrderId: string): Promise<ReportOrderRow | null> {
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE).select('*').eq('payment_order_id', paymentOrderId).maybeSingle();
  if (error) throw new Error('report_order_read_failed');
  return data ? mapRow(data as Row) : null;
}

export async function getReportOrderByToken(token: string): Promise<ReportOrderRow | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE).select('*').eq('result_token', token).maybeSingle();
  if (error) throw new Error('report_order_read_failed');
  return data ? mapRow(data as Row) : null;
}

/** 현재 상태를 조건으로 갱신한다 — 두 관리자가 동시에 눌러도 한 번만 넘어간다. */
export async function transitionReportOrder(
  id: string,
  to: ReportOrderStatus,
  patch: Record<string, unknown> = {},
): Promise<ReportOrderRow> {
  const current = await getReportOrder(id);
  if (!current) throw new Error('report_order_not_found');
  if (!canTransition(current.status, to)) throw new Error('report_order_invalid_transition');
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE)
    .update({ ...patch, status: to, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', current.status)
    .select('*')
    .maybeSingle();
  if (error) throw new Error('report_order_update_failed');
  if (!data) throw new Error('report_order_conflict');
  return mapRow(data as Row);
}

/** 카드 결제 확정(승인 return·정산 크론 어느 쪽이든 fulfill 이 부른다). 결제 대기 주문만 바꾼다 — 다시 불려도 무해. */
export async function markReportOrderPaidByPaymentOrder(paymentOrderId: string): Promise<void> {
  const service = await createServiceClient();
  const { error } = await service.from(TABLE)
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('payment_order_id', paymentOrderId)
    .eq('status', 'pending_payment')
    .select('id')
    .maybeSingle();
  if (error) throw new Error('report_order_update_failed');
}

/** 나이스페이 취소 통보·관리자 카드 환불. 이미 환불·취소된 주문은 그대로. */
export async function markReportOrderRefundedByPaymentOrder(paymentOrderId: string, note: string): Promise<void> {
  const service = await createServiceClient();
  const now = new Date().toISOString();
  const { error } = await service.from(TABLE)
    .update({ status: 'refunded', refunded_at: now, refund_note: note, updated_at: now })
    .eq('payment_order_id', paymentOrderId)
    .in('status', ['pending_payment', 'paid', 'generated', 'sent'])
    .select('id')
    .maybeSingle();
  if (error) throw new Error('report_order_update_failed');
}

export type ReportOrderFilter = 'awaiting_deposit' | 'paid' | 'generated' | 'sent' | 'closed';
const FILTER_STATUSES: Record<ReportOrderFilter, ReportOrderStatus[]> = {
  awaiting_deposit: ['awaiting_deposit'],
  paid: ['paid'],
  generated: ['generated'],
  sent: ['sent'],
  closed: ['cancelled', 'refunded', 'pending_payment'],
};

export async function listReportOrders(filter: ReportOrderFilter, page = 1): Promise<{ items: ReportOrderRow[]; hasMore: boolean }> {
  const service = await createServiceClient();
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  const { data, error } = await service.from(TABLE).select('*')
    .in('status', FILTER_STATUSES[filter])
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE);
  if (error) throw new Error('report_order_read_failed');
  const rows = (data ?? []) as Row[];
  return { items: rows.slice(0, PAGE_SIZE).map(mapRow), hasMore: rows.length > PAGE_SIZE };
}

/** 관리자 목록 상단: 기간 안에 입금 확인된 무통장 금액 합계(대시보드 매출엔 카드만 잡힌다). */
export async function sumConfirmedBankDeposits(sinceIso: string): Promise<{ count: number; amount: number }> {
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE).select('amount')
    .eq('pay_method', 'bank')
    .gte('deposit_confirmed_at', sinceIso)
    .in('status', ['paid', 'generated', 'sent']);
  if (error) throw new Error('report_order_read_failed');
  const rows = (data ?? []) as { amount: number }[];
  return { count: rows.length, amount: rows.reduce((sum, r) => sum + Number(r.amount), 0) };
}

const RETENTION_DAYS = 365;

/** 보관 기간(발송·종료 후 1년)이 지난 주문의 개인정보·결과 링크를 비우고 풀이 원본을 지운다. 거래 기록 칸은 남긴다. */
export async function purgeExpiredReportOrders(now = new Date()): Promise<{ orders: number; reports: number }> {
  const service = await createServiceClient();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400_000).toISOString();
  const { data, error } = await service.from(TABLE).select('id,external_report_id')
    .is('purged_at', null)
    .or(`and(status.eq.sent,sent_at.lt.${cutoff}),and(status.in.(cancelled,refunded,pending_payment),updated_at.lt.${cutoff})`);
  if (error) throw new Error('report_order_purge_read_failed');
  const rows = (data ?? []) as { id: string; external_report_id: string | null }[];
  if (rows.length === 0) return { orders: 0, reports: 0 };

  const purgedAt = now.toISOString();
  const { error: updateError } = await service.from(TABLE)
    .update({ name: null, phone: null, email: null, birth_input: null, memo: null, result_token: null, external_report_id: null, purged_at: purgedAt, updated_at: purgedAt })
    .in('id', rows.map((r) => r.id));
  if (updateError) throw new Error('report_order_purge_update_failed');

  const reportIds = rows.map((r) => r.external_report_id).filter((id): id is string => Boolean(id));
  if (reportIds.length > 0) {
    const { error: deleteError } = await service.from('admin_external_reports').delete().in('id', reportIds);
    if (deleteError) throw new Error('report_order_purge_delete_failed');
  }
  return { orders: rows.length, reports: reportIds.length };
}
