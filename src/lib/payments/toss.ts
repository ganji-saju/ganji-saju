import { PAYMENT_PACKAGES, getPackage, type PackageId } from './catalog';
import type { TossPaymentObject } from './order-ledger';

export const CREDIT_PACKAGES = PAYMENT_PACKAGES.filter((pkg) =>
  ['credit_15', 'credit_40', 'credit_100', 'subscription_30'].includes(pkg.id)
);

export { getPackage, type PackageId };

function getTossAuthorizationHeader() {
  if (!process.env.TOSS_SECRET_KEY) {
    throw new Error('TOSS_SECRET_KEY가 설정되어 있지 않습니다.');
  }

  return `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`;
}

async function parseTossResponse(response: Response, fallbackMessage: string) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    throw new Error(typeof error.message === 'string' ? error.message : fallbackMessage);
  }

  return body as TossPaymentObject;
}

export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: getTossAuthorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  return parseTossResponse(response, '결제 승인 실패');
}

export async function getPayment(paymentKey: string) {
  const response = await fetch(
    `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`,
    {
      method: 'GET',
      headers: {
        Authorization: getTossAuthorizationHeader(),
      },
    }
  );

  return parseTossResponse(response, '결제 조회 실패');
}

export async function getPaymentByOrderId(orderId: string) {
  const response = await fetch(
    `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: getTossAuthorizationHeader(),
      },
    }
  );

  return parseTossResponse(response, '결제 주문 조회 실패');
}

// 2026-05-25 Phase 2 — 결제 취소(환불). confirmPayment 와 동일 Basic auth.
//   Idempotency-Key 헤더로 재시도 시 이중취소 방지(환불 상태머신 재시도 안전).
export async function cancelPayment(
  paymentKey: string,
  options: { cancelReason: string; idempotencyKey?: string; cancelAmount?: number }
) {
  if (!process.env.TOSS_SECRET_KEY) {
    throw new Error('TOSS_SECRET_KEY가 설정되어 있지 않습니다.');
  }

  const headers: Record<string, string> = {
    Authorization: getTossAuthorizationHeader(),
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(
    `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cancelReason: options.cancelReason,
        ...(typeof options.cancelAmount === 'number' && options.cancelAmount > 0
          ? { cancelAmount: options.cancelAmount }
          : {}),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? '결제 취소 실패');
  }

  return response.json();
}
