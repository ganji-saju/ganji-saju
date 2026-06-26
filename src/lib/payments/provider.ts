// 2026-06-26 — 듀얼 PG 스위치. 토스 입점 심사 지연 대비 나이스페이 병행 연동.
//   PAYMENT_PROVIDER env 한 줄로 결제 PG 전환(재배포만으로). 미설정/오타 시 안전하게 toss.
//   참고: docs/payment-nicepay-migration.md
export type PaymentProvider = 'toss' | 'nicepay';

export function getPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === 'nicepay' ? 'nicepay' : 'toss';
}

export function isNicepay(): boolean {
  return getPaymentProvider() === 'nicepay';
}

export function isToss(): boolean {
  return getPaymentProvider() === 'toss';
}
