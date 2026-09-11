// 오프라인(전단·명함) 할인쿠폰 — 코드 파싱 + 할인 금액 계산(순수 함수).
//
// 설계: docs/discount-coupon-design.md
//
// 🔴 이 파일의 두 규칙은 돈에 직접 닿는다. 바꾸기 전에 설계문서 §2·§8 을 먼저 읽어라.
//   ① 코드의 접두 숫자는 **할인율이 아니라 등급 라벨**이다. 실제 %는 coupon_tiers 가 정본이고
//      관리자가 바꾼다(요구 2). 여기서 코드로부터 %를 계산하면 정본이 둘이 되어 반드시 어긋난다.
//   ② 상한 50% 는 관리자 입력 검증이 아니라 **금액 계산 지점에서 clamp** 한다. DB 직수정·
//      마이그레이션 실수로 60 이 들어와도 청구에는 못 넘어온다. 돈은 되돌릴 수 없다.

/** 발행 가능한 등급. 코드 접두 2자리와 같은 문자열이다. */
export const COUPON_TIERS = ['10', '20', '30', '40', '50'] as const;
export type CouponTier = (typeof COUPON_TIERS)[number];

export const MAX_DISCOUNT_PERCENT = 50;

/**
 * 인쇄/입력 형식: `ganji-10-0000` (사용자 결정 2026-09-11).
 * 저장·조회는 구분자를 뗀 정규형(`ganji100000`)으로 한다 — 손으로 옮겨 적을 때
 * 하이픈을 빼거나 공백을 넣는 것이 흔하고, 대소문자도 섞인다.
 */
const NORMALIZED_RE = /^ganji(10|20|30|40|50)(\d{4})$/;

export interface ParsedCouponCode {
  /** 정규형(소문자·구분자 없음). DB 의 discount_coupons.code 와 같은 값. */
  code: string;
  tier: CouponTier;
  serial: string;
}

/**
 * 입력 문자열 → 정규형. 실패하면 null(= 존재하지 않는 코드와 같은 취급).
 *
 * ⚠️ 파싱 성공은 **유효한 코드라는 뜻이 아니다.** 반드시 discount_coupons 화이트리스트를
 *   조회해야 한다. 정규식만 통과시켜 할인을 주면 4자리 전수대입으로 뚫린다.
 */
export function parseCouponCode(raw: string): ParsedCouponCode | null {
  if (typeof raw !== 'string') return null;
  // 하이픈·공백·언더스코어 제거 후 소문자. 'GANJI-10-0000' 도 'ganji 10 0000' 도 같은 코드다.
  const code = raw.trim().toLowerCase().replace(/[\s\-_]/g, '');
  const m = NORMALIZED_RE.exec(code);
  if (!m) return null;
  return { code, tier: m[1] as CouponTier, serial: m[2] };
}

/** 정규형 → 인쇄 형식(`ganji-10-0000`). 관리자 화면·발급 CSV 표시용. */
export function formatCouponCode(code: string): string {
  const parsed = parseCouponCode(code);
  return parsed ? `ganji-${parsed.tier}-${parsed.serial}` : code;
}

export interface CouponDiscount {
  /** 실제 적용된 할인율(clamp 후). 주문에 스탬프한다. */
  percent: number;
  discountWon: number;
  chargeAmount: number;
}

/**
 * 정가 + 할인율 → 청구액. **할인이 금액이 되는 유일한 지점.**
 *
 * - 상한 50% clamp(위 규칙 ②)
 * - 원 단위 절사(`Math.floor`) — 올림하면 정가보다 커질 수 없지만 PG 승인 금액과
 *   주문 금액이 1원 틀어질 여지를 아예 없앤다.
 * - 청구액 하한 1원: `payment_orders.amount` 에 `CHECK (amount > 0)` 가 걸려 있어
 *   0원이면 insert 가 throw 하고 prepare 가 500 이 된다(퍼널에 흔적도 안 남는다).
 *   현재 최저 판매가 3,300원 × 50% = 1,650원이라 도달 경로는 없지만 마지막 그물로 둔다.
 */
export function applyCouponDiscount(
  listAmount: number,
  percent: number,
  maxDiscountWon?: number | null
): CouponDiscount {
  const safeList = Number.isFinite(listAmount) ? Math.max(0, Math.trunc(listAmount)) : 0;
  const safePercent = Number.isFinite(percent)
    ? Math.min(Math.max(Math.trunc(percent), 0), MAX_DISCOUNT_PERCENT)
    : 0;

  if (safeList <= 0 || safePercent <= 0) {
    return { percent: safePercent, discountWon: 0, chargeAmount: safeList };
  }

  let discountWon = Math.floor((safeList * safePercent) / 100);
  if (typeof maxDiscountWon === 'number' && maxDiscountWon > 0) {
    discountWon = Math.min(discountWon, Math.trunc(maxDiscountWon));
  }
  // 청구액은 최소 1원 — 0원 주문은 DB 제약에 걸린다.
  discountWon = Math.min(discountWon, safeList - 1);
  discountWon = Math.max(discountWon, 0);

  return { percent: safePercent, discountWon, chargeAmount: safeList - discountWon };
}
