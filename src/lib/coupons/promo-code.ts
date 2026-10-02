// 2026-10-02 — 전단지 공용 할인코드(사용자 요청). 기존 할인쿠폰(discount-coupon)은 "코드 1장 = 1명 귀속"이라
//   전단지 받은 사람 모두가 같은 코드를 쓰는 용도에 맞지 않는다 → 상품·고정가만 정한 공용 코드를 따로 둔다.
//   귀속·사용 횟수 없음(신년운세는 사주 정체성당 재결제가 이미 막혀 있다). 로그인 계정만(resolveChargeForUser).
//   주문에는 coupon_code 대신 metadata.promoCode 로 남긴다 — coupon_code 는 승인 직전 귀속 검사(coupon-order-guard)를 탄다.

export interface PromoCode {
  /** 사용자에게 보이는 코드(정규형). */
  code: string;
  packageIds: readonly string[];
  /** 할인 후 결제 금액(원). */
  price: number;
}

export const PROMO_CODES: readonly PromoCode[] = [
  // 행운곳간 구매 고객 전단지 — 2027 신년운세 19,900 → 9,900.
  { code: '간지사주50', packageIds: ['taste_new_year_2027'], price: 9900 },
];

/** 띄어쓰기·대소문자·한글 조합 차이(NFC/NFD)는 같은 코드로 본다. */
export function normalizePromoInput(raw: string): string {
  return raw.normalize('NFC').replace(/[\s-]/g, '').toUpperCase();
}

/** 이 상품에 쓸 수 있는 공용 코드면 반환. 정가보다 비싸지 않을 때만(정가가 내려가면 정가가 이긴다). */
export function findPromoCode(raw: string | null | undefined, packageId: string, listAmount: number): PromoCode | null {
  if (!raw?.trim()) return null;
  const input = normalizePromoInput(raw);
  const promo = PROMO_CODES.find((p) => normalizePromoInput(p.code) === input);
  if (!promo || !promo.packageIds.includes(packageId) || promo.price >= listAmount) return null;
  return promo;
}

/** 공용 코드가 붙은 금액 — 표시(resolveChargeForUser)와 주문(createPaymentOrder)이 같은 함수를 쓴다. */
export function applyPromoPrice(listAmount: number, promo: PromoCode) {
  const chargeAmount = Math.min(listAmount, promo.price);
  const discountWon = listAmount - chargeAmount;
  return { chargeAmount, discountWon, percent: Math.round((discountWon / listAmount) * 100) };
}
