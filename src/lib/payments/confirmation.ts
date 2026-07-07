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

  // 2026-07-07 — 금액 정합은 confirm/route 의 order.amount(prepare 스냅샷) 비교가
  //   authoritative. 여기 카탈로그 상수 비교는 가격 변경 시 정상 주문을 거부해 제거.
  const pkg = getPackage(packageId);
  if (!pkg || !(amount > 0)) {
    return { ok: false, error: '잘못된 결제 정보입니다.' };
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
