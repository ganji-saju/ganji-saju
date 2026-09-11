// 결제수단 정본 테이블.
//
// 🔴 2026-09-08 — 나이스페이 결제창은 **수단 순서를 제어할 방법이 없다**(매뉴얼의 UI
//   파라미터는 disableScroll·skinType·logoImgUrl 등뿐). 그래서 순서를 이 배열로 끌어왔다:
//   **아래 배열 순서가 곧 화면 순서다.** 간편결제 3종이 위, 카드가 아래.
//   설계: docs/payment-easypay-picker-design.md
//
// ⚠️ 이 목록은 토스 경로와 공유된다. 토스는 CARD/TRANSFER 만 이해하므로 간편결제 코드가
//   토스로 새면 결제가 깨진다 → `only: 'nicepay'` 를 픽커가 provider 로 거른다.
//
// ⚠️ 실시간 계좌이체(bank)에는 `nicepay` 매핑이 **없다**. 나이스페이 안내상 계좌이체를
//   넣으면 결제 자체가 막힌다(2026-09-08). 되살리려면 나이스페이 확인부터 받을 것.
//   가상계좌(vbank)·휴대폰(cellphone)도 같은 이유로 추측 추가 금지.

/** 어느 PG 에서만 노출할지. null = 공용. */
export type PaymentMethodProviderScope = 'nicepay' | null;

/**
 * 간편결제 브랜드 컬러. 사용자가 카카오/네이버/삼성 버튼을 **색으로** 먼저 알아본다.
 * ⚠️ 공식 CI 값이다. 임의로 바꾸지 말 것(브랜드 가이드 위반이자 인지도 손실).
 *   카카오 #FEE500 / 네이버 #03C75A / 삼성 #1428A0
 */
export interface PaymentMethodBrand {
  /** 버튼 배경 */
  bg: string;
  /** 배경 위 글자·로고 색 */
  fg: string;
}

export const TOSS_PAYMENT_METHOD_OPTIONS = [
  {
    code: 'KAKAOPAY',
    label: '카카오페이',
    shortLabel: '카카오페이',
    description: '카카오페이 앱에서 카드 또는 카카오페이머니로 결제합니다.',
    brand: { bg: '#FEE500', fg: '#191600' },
    // 'kakaopay' = 카드/머니 둘 다 — 사용자가 카카오 창에서 고른다.
    //   (카드 전용은 kakaopayCard, 머니 전용은 kakaopayMoney)
    nicepayMethod: 'kakaopay',
    only: 'nicepay',
  },
  {
    code: 'NAVERPAY',
    label: '네이버페이',
    shortLabel: '네이버페이',
    description: '네이버페이에 등록된 카드로 결제합니다.',
    brand: { bg: '#03C75A', fg: '#FFFFFF' },
    // ⚠️ 매뉴얼: naverpayCard = "네이버페이-신용카드 전액결제(**포인트 이용불가**)".
    //   포인트 결제가 필요해지면 나이스페이에 별도 수단값을 확인할 것.
    nicepayMethod: 'naverpayCard',
    only: 'nicepay',
  },
  {
    code: 'SAMSUNGPAY',
    label: '삼성페이',
    shortLabel: '삼성페이',
    description: '삼성페이에 등록된 카드로 결제합니다.',
    brand: { bg: '#1428A0', fg: '#FFFFFF' },
    nicepayMethod: 'samsungpayCard',
    only: 'nicepay',
  },
  {
    code: 'CARD',
    label: '신용/체크카드',
    shortLabel: '카드',
    description: '신용카드, 체크카드로 결제합니다.',
    brand: null,
    nicepayMethod: 'card',
    only: null,
  },
  {
    code: 'TRANSFER',
    label: '실시간 계좌이체',
    shortLabel: '실시간 계좌이체',
    description: '은행 계좌에서 실시간으로 바로 이체하는 방식입니다.',
    brand: null,
    // 나이스페이 매핑 없음 — 위 주석 참조. 토스 전용으로만 살아 있다.
    nicepayMethod: null,
    only: null,
  },
] as const;

export type TossPaymentMethodCode = (typeof TOSS_PAYMENT_METHOD_OPTIONS)[number]['code'];
export type PaymentMethodOption = (typeof TOSS_PAYMENT_METHOD_OPTIONS)[number];

/** 토스 결제창이 이해하는 코드. 간편결제 코드가 여기 새면 안 된다. */
export const TOSS_SUPPORTED_METHOD_CODES = ['CARD', 'TRANSFER'] as const;

export const DEFAULT_TOSS_PAYMENT_METHOD: TossPaymentMethodCode = 'CARD';

export function getTossPaymentMethodOption(code: TossPaymentMethodCode): PaymentMethodOption {
  return (
    TOSS_PAYMENT_METHOD_OPTIONS.find((option) => option.code === code) ??
    TOSS_PAYMENT_METHOD_OPTIONS.find((option) => option.code === 'CARD')!
  );
}

/**
 * provider 별 노출 목록. 배열 순서 = 화면 순서.
 * toss 에서는 `only: 'nicepay'` 항목을 전부 제거한다(토스가 못 알아듣는 코드).
 */
export function paymentMethodOptionsFor(
  provider: 'toss' | 'nicepay' | undefined
): readonly PaymentMethodOption[] {
  if (provider !== 'nicepay') {
    return TOSS_PAYMENT_METHOD_OPTIONS.filter((option) => option.only !== 'nicepay');
  }
  // 나이스페이: 계좌이체 영구 제외(넣으면 결제가 막힌다).
  return TOSS_PAYMENT_METHOD_OPTIONS.filter((option) => option.nicepayMethod !== null);
}
