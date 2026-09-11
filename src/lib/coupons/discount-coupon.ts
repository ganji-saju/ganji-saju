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

// ─────────────────────────────────────────────────────────────
// 귀속·재사용 판정 (설계 §5). DB 를 읽은 뒤의 **결정**만 여기서 한다 — 조회·쓰기는 coupon-charge.ts.
// ─────────────────────────────────────────────────────────────

/** 코드가 적용되지 않은 이유. 화면 문구는 couponRejectMessage 가 정본. */
export type CouponRejectReason =
  | 'invalid_format'
  | 'not_found'
  | 'disabled'
  | 'expired'
  | 'env_mismatch'
  | 'bound_to_other'
  | 'account_has_other'
  | 'not_eligible'
  | 'rate_limited'
  | 'bind_failed';

/** 미결제 귀속을 풀어 다른 사람이 쓸 수 있게 되는 시간(설계 §5-2 · B 결정의 완화책 1). */
export const COUPON_RECLAIM_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * staging·로컬·프리뷰에서만 쓰는 배치. staging 과 프로덕션이 **같은 DB** 라, 테스트가 실물 전단
 * 코드를 귀속시키면 그 고객의 쿠폰이 타 버린다(설계 §6). 반대로 테스트 코드가 운영에서 먹혀도 안 된다.
 */
export const STAGING_TEST_BATCH = 'staging-test';

/** 이 요청에서 쓸 수 있는 쿠폰 종류. production = 실물 배치만 · test = staging-test 만 · null = 전부 거부. */
export type CouponEnv = 'production' | 'test' | null;

/**
 * 요청 호스트(payment-origin.ts 판정) + 배포 환경 → 쿠폰 환경. **실패-닫힘**이다.
 *
 * 🔴 호스트만 보면 뚫린다: `/api/*` 는 canonical 301 에서 빠져(proxy.ts — 크론 때문) 프로덕션 배포에
 *   `*.vercel.app` 별칭으로도 닿는다. 그 호스트는 'preview' 로 판정되므로, "프로덕션이 아니면 테스트"
 *   로 두면 프로덕션 DB·실결제에서 staging-test 코드가 먹힌다. 그래서
 *   ① preview·unknown 은 어떤 쿠폰도 받지 않고 ② VERCEL_ENV=production 은 호스트와 무관하게 테스트 코드를 거부한다.
 */
export function resolveCouponEnv(originEnv: string, vercelEnv: string | undefined): CouponEnv {
  if (originEnv === 'production') return 'production';
  if ((originEnv === 'staging' || originEnv === 'local') && vercelEnv !== 'production') return 'test';
  return null;
}

/** 쿠폰 할인이 붙지 않는 상품. 전달물이 **전(재화)**이라 할인하면 다른 상품 가격 페그가 깨진다(§7). */
const COUPON_EXCLUDED_PACKAGE_IDS = new Set(['taste_dialogue_entry']);

export function isCouponEligiblePackage(pkg: { id: string; kind: string }): boolean {
  return pkg.kind !== 'credits' && !COUPON_EXCLUDED_PACKAGE_IDS.has(pkg.id);
}

/** discount_coupons 행 + coupon_tiers 조인. */
export interface CouponRow {
  code: string;
  batch: string | null;
  bound_user_id: string | null;
  bound_at: string | null;
  bound_percent: number | null;
  bound_max_discount_won: number | null;
  expires_at: string;
  disabled_at: string | null;
  coupon_tiers: { percent: number; max_discount_won: number | null; disabled_at: string | null } | null;
}

export type CouponEvaluation =
  | {
      ok: true;
      /** self = 본인 재사용(쓰기 없음) · claim = 최초 귀속 · reclaim = 24h 미결제 회수 후 귀속 */
      mode: 'self' | 'claim' | 'reclaim';
      percent: number;
      maxDiscountWon: number | null;
    }
  | { ok: false; reason: CouponRejectReason };

/**
 * 이 주문이 쿠폰을 **붙잡고 있는가**(= 회수를 막는가).
 *
 * 🔴 설계 §5-2 의 SQL 은 막는 상태를 `prepared·in_progress·confirmed·fulfilling·fulfillment_failed`
 *   로 나열했는데 **`fulfilled` 가 빠져 있다.** 그대로면 결제를 마친 사람의 쿠폰이 24시간 뒤 남에게
 *   넘어간다(요구 4 위반). 그래서 목록을 뒤집어 "돈이 안 움직인 게 확실한 상태"만 풀어 준다 —
 *   나중에 상태가 추가돼도 기본값이 '붙잡음'(요구 4 쪽)이 된다.
 *   `prepared` 는 결제창에 들어가기 전이라, 주문 만료(45분)가 지나면 정산 크론이 expired 로
 *   바꾸기 전이라도 풀어 준다.
 */
export function orderHoldsCoupon(
  order: { status: string; expires_at: string | null },
  now: Date
): boolean {
  if (order.status === 'payment_failed' || order.status === 'canceled' || order.status === 'expired') {
    return false;
  }
  if (order.status === 'prepared' && order.expires_at) {
    const expiresAt = Date.parse(order.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return false;
  }
  return true;
}

/**
 * 쿠폰 행 하나가 이 사용자에게 지금 적용되는가.
 *
 * - 만료·회수(쿠폰·등급 둘 다)는 **귀속 여부와 무관하게** 매번 본다. v1 은 귀속 후 재검사가
 *   없어 만료·킬스위치가 실효 0 이었다(설계 §3-3).
 * - 본인 재사용은 **귀속 순간의 스냅샷**(bound_percent·bound_max_discount_won)을 쓴다.
 *   🔴 설계 §5-2 SQL 은 본인 재사용 때도 `bound_percent = $pct` 로 덮어써, 관리자가 요율을
 *   내리면 이미 쓰던 고객도 같이 깎인다(§2 스냅샷 약속 위반). 본인 경로는 쓰기를 하지 않는다.
 * - 최초·회수 귀속은 등급의 **현재** 값을 쓴다(그 값이 그대로 스냅샷된다).
 *
 * @param holderHasLiveOrder 다른 사람에게 귀속된 경우에만 의미 — 그 사람의 이 코드 주문 중
 *   `orderHoldsCoupon` 인 것이 하나라도 있는가.
 */
export function evaluateCouponRow(input: {
  row: CouponRow;
  userId: string;
  now: Date;
  /** resolveCouponEnv 결과. null 이면 어떤 쿠폰도 적용하지 않는다. */
  env: CouponEnv;
  holderHasLiveOrder: boolean;
}): CouponEvaluation {
  const { row, userId, now } = input;
  const tier = row.coupon_tiers;
  // 등급 행이 없으면 요율을 모른다 → 할인하지 않는다(실패-닫힘).
  if (!tier || row.disabled_at || tier.disabled_at) return { ok: false, reason: 'disabled' };

  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  if (!input.env || (input.env === 'production') === (row.batch === STAGING_TEST_BATCH)) {
    return { ok: false, reason: 'env_mismatch' };
  }

  if (row.bound_user_id === userId) {
    return {
      ok: true,
      mode: 'self',
      percent: row.bound_percent ?? tier.percent,
      maxDiscountWon: row.bound_percent == null ? tier.max_discount_won : row.bound_max_discount_won,
    };
  }

  const current = { percent: tier.percent, maxDiscountWon: tier.max_discount_won };
  if (!row.bound_user_id) return { ok: true, mode: 'claim', ...current };

  // 남의 쿠폰. 24시간 넘게 결제가 없을 때만 회수한다. bound_at 이 없으면 나이를 모르므로 회수하지 않는다
  // (요구 4 — 쓰던 사람 쪽을 보호).
  const boundAt = row.bound_at ? Date.parse(row.bound_at) : NaN;
  const stale = Number.isFinite(boundAt) && now.getTime() - boundAt >= COUPON_RECLAIM_AFTER_MS;
  if (stale && !input.holderHasLiveOrder) return { ok: true, mode: 'reclaim', ...current };
  return { ok: false, reason: 'bound_to_other' };
}

/** 체크아웃·prepare 가 보여 주는 문구. 이유별 구분은 사용자가 다음 행동을 고를 수 있을 만큼만. */
export function couponRejectMessage(reason: CouponRejectReason): string {
  switch (reason) {
    case 'expired':
      return '사용 기간이 지난 쿠폰입니다.';
    case 'bound_to_other':
      return '이미 다른 분이 사용 중인 쿠폰입니다.';
    case 'account_has_other':
      return '이 계정에는 이미 다른 쿠폰이 등록되어 있어요. 쿠폰은 계정당 1개입니다.';
    case 'not_eligible':
      return '이 상품에는 쿠폰이 적용되지 않습니다.';
    case 'rate_limited':
      return '쿠폰 입력 시도가 너무 많습니다. 내일 다시 시도해 주세요.';
    case 'bind_failed':
      return '쿠폰을 적용하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.';
    default:
      return '사용할 수 없는 쿠폰 코드입니다.';
  }
}
