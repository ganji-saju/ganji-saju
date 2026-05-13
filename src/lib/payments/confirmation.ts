import {
  getPackage,
  type PaymentPackage,
} from '@/lib/payments/catalog';

export interface PaymentConfirmationInput {
  paymentKey: string;
  orderId: string;
  amount: number;
  packageId: string;
  slug: string | null;
  scope: string | null;
  pkg: PaymentPackage;
}

export type PaymentConfirmationValidation =
  | {
      ok: true;
      input: PaymentConfirmationInput;
    }
  | {
      ok: false;
      error: string;
    };

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readAmount(payload: Record<string, unknown>) {
  const amount = Number(payload.amount);
  return Number.isFinite(amount) ? amount : null;
}

export function validatePaymentConfirmationPayload(
  payload: unknown
): PaymentConfirmationValidation {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: '결제 정보가 올바르지 않습니다.' };
  }

  const data = payload as Record<string, unknown>;
  const paymentKey = readString(data, 'paymentKey');
  const orderId = readString(data, 'orderId');
  const packageId = readString(data, 'packageId');
  const amount = readAmount(data);
  const slug = readString(data, 'slug') || null;
  const scope = readString(data, 'scope') || null;

  if (!paymentKey || !orderId || !packageId || amount === null) {
    return { ok: false, error: '결제 정보가 올바르지 않습니다.' };
  }

  const pkg = getPackage(packageId);
  if (!pkg || pkg.price !== amount) {
    return { ok: false, error: '잘못된 결제 정보입니다.' };
  }

  if ((pkg.kind === 'lifetime_report' || pkg.requiresSlug) && !slug) {
    return {
      ok: false,
      error: '이 상품 결제에는 연결할 결과 식별자가 필요합니다.',
    };
  }

  return {
    ok: true,
    input: {
      paymentKey,
      orderId,
      amount,
      packageId,
      slug,
      scope,
      pkg,
    },
  };
}
