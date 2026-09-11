// 할인쿠폰 — 청구액 계산(체크아웃 표시 · prepare 공통) + 귀속 쓰기.
//
// 설계: docs/discount-coupon-design.md §3-3 · §5
//
// 🔴 체크아웃 화면과 prepare 가 **같은 함수**로 금액을 낸다. 둘이 따로 계산하면
//   "화면은 할인가, 청구는 정가"(또는 그 반대)가 난다. 판정 규칙은 discount-coupon.ts 의
//   순수 함수가 정본이고, 이 파일은 DB 를 읽고 쓰는 일만 한다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import type { PaymentPackage } from '@/lib/payments/catalog';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { resolvePaymentOriginEnv } from '@/lib/payments/payment-origin';
import {
  consumeMemberBenefit,
  dailyPeriodKey,
  getMemberBenefitUsed,
} from '@/lib/credits/member-benefits';
import {
  COUPON_RECLAIM_AFTER_MS,
  applyCouponDiscount,
  canReleaseCoupon,
  evaluateCouponRow,
  isCouponEligiblePackage,
  orderHoldsCoupon,
  parseCouponCode,
  resolveCouponEnv,
  type CouponEnv,
  type CouponRejectReason,
  type CouponRow,
} from './discount-coupon';

/** 요청 호스트 → 쿠폰 환경. 체크아웃·prepare 가 같은 판정을 쓰도록 여기 하나만 둔다. */
export function couponEnvForHost(host: string | null | undefined): CouponEnv {
  return resolveCouponEnv(resolvePaymentOriginEnv(host), process.env.VERCEL_ENV);
}

const COUPON_COLUMNS =
  'code, batch, bound_user_id, bound_at, bound_percent, bound_max_discount_won, expires_at, disabled_at, released_at, coupon_tiers(percent, max_discount_won, disabled_at)';

/**
 * 코드 추측 시도 한도(계정 · KST 하루). 056 `consume_member_benefit` 카운터를 재사용한다(설계 §6).
 * **없는 코드(not_found)만** 센다. 맞는 코드는 체크아웃 렌더와 prepare 에서 두 번 조회되는데,
 * 그걸 다 세면 한도 근처의 정상 고객이 "할인가를 보고 → 결제 버튼에서 rate_limited" 를 겪는다.
 * 추측은 거의 전부 빗나가므로 빗나간 것만 세도 억제력은 같다.
 * ⚠️ 한도 확인(읽기)과 차감이 원자적이지 않아 한 계정의 동시 폭주는 한도를 넘길 수 있다.
 *   계정 생성 비용이 0 이라(B 결정) 어차피 벽이 아니라 과속방지턱이다.
 */
export const COUPON_ATTEMPT_DAILY_LIMIT = 10;
const COUPON_ATTEMPT_BENEFIT = 'coupon_code_attempt';

/** prepare 가 귀속에 쓰는 값. 화면에는 내려보내지 않는다. */
export interface CouponClaim {
  code: string;
  mode: 'self' | 'claim' | 'reclaim';
  percent: number;
  maxDiscountWon: number | null;
  /** reclaim 일 때 풀어낼 이전 귀속자. */
  holderUserId: string | null;
  /** 요구 6 "동시에 1개": 이 계정의 **죽은** 쿠폰. 새 코드를 귀속하기 직전에 자리에서 뺀다(080 released_at). */
  releaseCode: string | null;
}

export interface ChargeQuote {
  /** 정가(리졸버 스냅샷가). */
  listAmount: number;
  discountWon: number;
  /** 실청구액 = 화면 최종 결제 금액 = prepare 가 만들 order.amount. */
  chargeAmount: number;
  percent: number;
  /** 적용된 쿠폰(정규형). 화면은 이 값을 prepare 로 되돌려 보낸다. */
  couponCode: string | null;
  /** 입력한 코드(또는 등록된 쿠폰)가 적용되지 않은 이유. 없으면 null. */
  reason: CouponRejectReason | null;
  claim: CouponClaim | null;
}

/**
 * code = 코드 한 장 / bound = 이 계정이 **지금 차지하고 있는** 쿠폰(released 제외 — 080 부분 유니크가
 * 이 조건으로 한 행만 허용하므로 maybeSingle 이 안전하다).
 */
async function selectCoupon(
  service: SupabaseClient,
  by: 'code' | 'bound',
  value: string
): Promise<CouponRow | null> {
  const query = service.from('discount_coupons').select(COUPON_COLUMNS);
  const { data, error } = await (by === 'code'
    ? query.eq('code', value)
    : query.eq('bound_user_id', value).is('released_at', null)
  ).maybeSingle();
  if (error) {
    // 조회 실패 = 쿠폰 없음(할인 0). 화면과 prepare 는 **따로** 조회하므로 한쪽만 실패할 수 있다 —
    //   그 어긋남은 prepare 의 표시 금액 대조(expectedAmount)가 409 로 잡는다.
    console.error('[coupon] discount_coupons 조회 실패', error.message);
    return null;
  }
  return (data as unknown as CouponRow | null) ?? null;
}

/** 다른 사람에게 귀속된 코드 — 그 사람의 이 코드 주문 중 회수를 막는 게 있는가. 조회 실패면 '있다'(요구 4 쪽). */
async function holderHasLiveOrder(
  service: SupabaseClient,
  code: string,
  holderUserId: string,
  now: Date
): Promise<boolean> {
  const { data, error } = await service
    .from('payment_orders')
    .select('status, expires_at')
    .eq('coupon_code', code)
    .eq('user_id', holderUserId);
  if (error || !data) return true;
  return (data as { status: string; expires_at: string | null }[]).some((order) =>
    orderHoldsCoupon(order, now)
  );
}

/**
 * 이 사용자가 이 상품을 지금 결제하면 얼마인가. **읽기만 한다**(귀속은 bindCouponClaim).
 *
 * - 쿠폰은 "상태"다. 코드를 안 넣어도 계정에 귀속된 쿠폰이 있으면 붙는다(요구 7 · 설계 §11-A D).
 * - `couponInput` 은 아직 귀속 안 된 코드의 **미리보기**다. 🔴 이 인자가 없으면 전단 첫 사용
 *   (= 대다수)에서 화면은 정가, 청구는 할인가로 갈린다.
 * - 동시에 1개(요구 6, 2026-09-11 사용자 결정): 살아 있는 쿠폰이 있는 계정이 다른 코드를 넣으면
 *   넣은 코드는 거부하고 **기존 쿠폰을 계속 적용**한다. 등록된 쿠폰이 **죽었으면**(만료·회수) 새 코드를
 *   받고, prepare 가 귀속하면서 옛 쿠폰을 자리에서 뺀다(claim.releaseCode).
 */
export async function resolveChargeForUser(
  pkg: PaymentPackage,
  userId: string | null,
  couponInput: string | null | undefined,
  opts: { env: CouponEnv; service?: SupabaseClient; now?: Date }
): Promise<ChargeQuote> {
  const listAmount = await resolvePackagePrice(pkg.id);
  const noDiscount = (reason: CouponRejectReason | null): ChargeQuote => ({
    listAmount,
    discountWon: 0,
    chargeAmount: listAmount,
    percent: 0,
    couponCode: null,
    reason,
    claim: null,
  });

  // 쿠폰은 로그인 계정에 붙는다(B 결정). 비로그인은 조회 자체를 하지 않는다 — 익명 추측 창구를 열지 않는다.
  if (!userId) return noDiscount(null);

  const raw = couponInput?.trim() ? couponInput : null;
  const parsed = raw ? parseCouponCode(raw) : null;
  const service = opts.service ?? (await createServiceClient());
  const now = opts.now ?? new Date();

  const bound = await selectCoupon(service, 'bound', userId);

  // 전(재화)이 전달물인 상품은 할인하지 않는다(§7). 등록된 쿠폰이 있거나 코드를 넣었으면 이유를 보여 준다
  //   — 할인이 안 붙는 이유가 안 보이면 버그 신고가 된다.
  if (!isCouponEligiblePackage(pkg)) return noDiscount(raw || bound ? 'not_eligible' : null);

  // 등록된 쿠폰이 죽었고 이 환경이 그 행을 건드려도 되면 자리를 비워 줄 수 있다(동시에 1개) — canReleaseCoupon 주석.
  const releasable = bound && canReleaseCoupon(bound, now, opts.env) ? bound : null;
  let row = bound;
  let reason: CouponRejectReason | null = null;
  if (raw && !parsed) {
    reason = 'invalid_format';
  } else if (parsed && bound && parsed.code !== bound.code && !releasable) {
    reason = 'account_has_other';
  } else if (parsed && (!bound || parsed.code !== bound.code)) {
    const period = dailyPeriodKey(now);
    const used = await getMemberBenefitUsed(userId, COUPON_ATTEMPT_BENEFIT, period, service);
    if (used >= COUPON_ATTEMPT_DAILY_LIMIT) return noDiscount('rate_limited');
    row = await selectCoupon(service, 'code', parsed.code);
    if (!row) {
      await consumeMemberBenefit(userId, COUPON_ATTEMPT_BENEFIT, period, COUPON_ATTEMPT_DAILY_LIMIT, service);
      return noDiscount('not_found');
    }
  }
  if (!row) return noDiscount(reason);

  const holder = row.bound_user_id && row.bound_user_id !== userId ? row.bound_user_id : null;
  const evaluation = evaluateCouponRow({
    row,
    userId,
    now,
    env: opts.env,
    holderHasLiveOrder: holder ? await holderHasLiveOrder(service, row.code, holder, now) : false,
  });
  if (!evaluation.ok) return noDiscount(reason ?? evaluation.reason);

  // createPaymentOrder 와 **같은 함수·같은 입력**으로 계산한다 → 화면 금액 = order.amount.
  const discount = applyCouponDiscount(listAmount, evaluation.percent, evaluation.maxDiscountWon);
  return {
    listAmount,
    discountWon: discount.discountWon,
    chargeAmount: discount.chargeAmount,
    percent: discount.percent,
    couponCode: row.code,
    reason,
    claim: {
      code: row.code,
      mode: evaluation.mode,
      percent: evaluation.percent,
      maxDiscountWon: evaluation.maxDiscountWon,
      holderUserId: evaluation.mode === 'reclaim' ? holder : null,
      // claim 이 나오는 건 "살아 있는 등록 쿠폰(self)" 이거나 "새 코드" 뿐이라, releasable 은 후자에서만 채워진다.
      releaseCode: releasable?.code ?? null,
    },
  };
}

/**
 * 쿠폰을 이 사용자에게 귀속시킨다(CAS). 실패하면 null — 호출부는 **정가로 진행하지 말고 멈춘다.**
 *
 * - self: 쓰지 않는다. 🔴 스냅샷(bound_percent)을 덮으면 요율 인하가 기존 고객에게 번진다.
 * - claim: `bound_user_id is null` 조건부 UPDATE — 동시에 두 명이 넣어도 한 명만 1행을 얻는다.
 * - reclaim: 이전 귀속자·24h 경과를 조건에 다시 건다. 이전 귀속자가 그 사이 새 주문을 만드는
 *   경합은 여기서 못 막는다 → 승인 직전 재검증(PR4, 설계 §5-3)이 `bound_user_id === order.userId` 로 자른다.
 * - 동시에 1개: 등록된 쿠폰이 죽었으면(releaseCode) **먼저** released_at 을 찍어 자리에서 뺀다 —
 *   순서가 반대면 새 귀속이 부분 유니크(080)에 걸린다. 두 UPDATE 는 원자적이지 않으므로, 새 귀속이
 *   실패하면 **이번 요청이 찍은 released_at 만** 되돌린다. 🔴 되돌리지 않으면 계정은 쿠폰 0개가 되고,
 *   "죽음"은 일시적일 수 있어(관리자가 배치·등급·만료를 되살림) 되살아났을 본인 쿠폰(요구 7)을 영구히 잃는다.
 *   다른 탭에서 방금 다른 코드를 귀속했으면 부분 유니크 인덱스가 23505 로 막는다.
 * - released 된 쿠폰은 종료 상태라 claim·reclaim 대상이 아니다(조건에 released_at is null).
 */
export async function bindCouponClaim(
  claim: CouponClaim,
  userId: string,
  opts: { origin: string; service?: SupabaseClient; now?: Date }
): Promise<{ code: string; percent: number; maxDiscountWon: number | null } | null> {
  const coupon = { code: claim.code, percent: claim.percent, maxDiscountWon: claim.maxDiscountWon };
  if (claim.mode === 'self') return coupon;
  if (claim.mode === 'reclaim' && !claim.holderUserId) return null;

  const service = opts.service ?? (await createServiceClient());
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();

  if (claim.releaseCode) {
    const { error } = await service
      .from('discount_coupons')
      .update({ released_at: nowIso })
      .eq('code', claim.releaseCode)
      .eq('bound_user_id', userId)
      .is('released_at', null);
    if (error) {
      console.error('[coupon] 옛 쿠폰 자리 비우기 실패', error.message);
      return null;
    }
  }

  const update = service
    .from('discount_coupons')
    .update({
      bound_user_id: userId,
      bound_at: nowIso,
      bound_percent: claim.percent,
      bound_max_discount_won: claim.maxDiscountWon,
      bound_origin: opts.origin,
    })
    .eq('code', claim.code)
    .is('disabled_at', null)
    .is('released_at', null)
    .gt('expires_at', nowIso);
  const guarded =
    claim.mode === 'claim'
      ? update.is('bound_user_id', null)
      : update
          .eq('bound_user_id', claim.holderUserId!)
          .lt('bound_at', new Date(now.getTime() - COUPON_RECLAIM_AFTER_MS).toISOString());

  const { data, error } = await guarded.select('code').maybeSingle();
  // 23505 = 동시에 1개 인덱스. 그 외는 진짜 오류 — 둘 다 할인 없이 결제를 진행하면 안 된다.
  if (error && error.code !== '23505') console.error('[coupon] 귀속 실패', error.message);
  if (!error && data) return coupon;

  if (claim.releaseCode) {
    // 보상: 이번 요청이 찍은 행만(released_at = nowIso). 그 사이 다른 탭이 새 쿠폰을 잡았으면 여기서 23505 가
    //   나고 옛 쿠폰은 빠진 채로 남는다 — 그 계정은 이미 살아 있는 쿠폰이 있으니 그게 맞다.
    const { error: undoError } = await service
      .from('discount_coupons')
      .update({ released_at: null })
      .eq('code', claim.releaseCode)
      .eq('bound_user_id', userId)
      .eq('released_at', nowIso);
    if (undoError && undoError.code !== '23505') {
      console.error('[coupon] 옛 쿠폰 되돌리기 실패', undoError.message);
    }
  }
  return null;
}
