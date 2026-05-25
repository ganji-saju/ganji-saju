import { PAYMENT_PACKAGES, getPackage, type PackageId } from './catalog';

export const CREDIT_PACKAGES = PAYMENT_PACKAGES.filter((pkg) =>
  ['credit_1', 'credit_3', 'credit_7', 'subscription_30'].includes(pkg.id)
);

export { getPackage, type PackageId };

export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  if (!process.env.TOSS_SECRET_KEY) {
    throw new Error('TOSS_SECRET_KEY가 설정되어 있지 않습니다.');
  }

  const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message ?? '결제 승인 실패');
  }

  return response.json();
}

// 2026-05-25 Phase 2 — 결제 취소(환불). confirmPayment 와 동일 Basic auth.
//   Idempotency-Key 헤더로 재시도 시 이중취소 방지(환불 상태머신 재시도 안전).
export async function cancelPayment(
  paymentKey: string,
  options: { cancelReason: string; idempotencyKey?: string }
) {
  if (!process.env.TOSS_SECRET_KEY) {
    throw new Error('TOSS_SECRET_KEY가 설정되어 있지 않습니다.');
  }

  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,
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
      body: JSON.stringify({ cancelReason: options.cancelReason }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? '결제 취소 실패');
  }

  return response.json();
}
