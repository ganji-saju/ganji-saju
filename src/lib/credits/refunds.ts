import { createServiceClient } from '@/lib/supabase/server';

export interface CreditPurchaseRevokeResult {
  revoked: boolean;
  paymentKey: string | null;
  creditAmount: number;
  amountInitial: number;
  refundAmount: number | null;
  auditId: string | null;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readBoolean(value: unknown, key: string) {
  return readObject(value)[key] === true;
}

function readNumber(value: unknown, key: string) {
  const number = readObject(value)[key];
  return typeof number === 'number' && Number.isFinite(number) ? number : 0;
}

function readNullableNumber(value: unknown, key: string) {
  const number = readObject(value)[key];
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
}

function readNullableString(value: unknown, key: string) {
  const string = readObject(value)[key];
  return typeof string === 'string' && string.length > 0 ? string : null;
}

export async function revokeCreditPurchaseLots(input: {
  userId: string;
  paymentKey: string;
  refundRequestId: string;
  refundAmount: number | null;
  reason: string;
  actor: string | null;
}): Promise<CreditPurchaseRevokeResult> {
  const service = await createServiceClient();
  const { data, error } = await service.rpc('revoke_credit_purchase_lots', {
    p_user_id: input.userId,
    p_payment_key: input.paymentKey,
    p_refund_request_id: input.refundRequestId,
    p_refund_amount: input.refundAmount,
    p_reason: input.reason,
    p_actor: input.actor,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    revoked: readBoolean(data, 'revoked'),
    paymentKey: readNullableString(data, 'paymentKey'),
    creditAmount: readNumber(data, 'creditAmount'),
    amountInitial: readNumber(data, 'amountInitial'),
    refundAmount: readNullableNumber(data, 'refundAmount'),
    auditId: readNullableString(data, 'auditId'),
  };
}
