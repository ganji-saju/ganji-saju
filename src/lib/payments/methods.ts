export const TOSS_PAYMENT_METHOD_OPTIONS = [
  {
    code: 'CARD',
    label: '카드 결제',
    shortLabel: '카드',
    description: '신용카드, 체크카드와 카드 기반 간편결제를 이용합니다.',
  },
  {
    code: 'TRANSFER',
    label: '실시간 계좌이체',
    shortLabel: '실시간 계좌이체',
    description: '은행 계좌에서 실시간으로 바로 이체하는 방식입니다.',
  },
] as const;

export type TossPaymentMethodCode = (typeof TOSS_PAYMENT_METHOD_OPTIONS)[number]['code'];

export const DEFAULT_TOSS_PAYMENT_METHOD: TossPaymentMethodCode = 'CARD';

export function getTossPaymentMethodOption(code: TossPaymentMethodCode) {
  return (
    TOSS_PAYMENT_METHOD_OPTIONS.find((option) => option.code === code) ??
    TOSS_PAYMENT_METHOD_OPTIONS[0]
  );
}
