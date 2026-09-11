// 할인쿠폰 — 청구액 계산(체크아웃 표시 · prepare 공통) + 귀속 쓰기.
//
// 설계: docs/discount-coupon-design.md §3-3 · §5
//
// 🔴 체크아웃 화면과 prepare 가 **같은 함수**로 금액을 낸다. 둘이 따로 계산하면
//   "화면은 할인가, 청구는 정가"(또는 그 반대)가 난다. 판정 규칙은 discount-coupon.ts 의
//   순수 함수가 정본이고, 이 파일은 DB 를 읽고 쓰는 일만 한다.
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import type { PaymentPackage } from '@/lib/payments/catalog';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { after } from 'next/server';
import { readPaymentOrigin, resolvePaymentOriginEnv } from '@/lib/payments/payment-origin';
import { dailyPeriodKey } from '@/lib/credits/member-benefits';
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import {
  COUPON_RECLAIM_AFTER_MS,
  applyCouponDiscount,
  canReleaseCoupon,
  evaluateCouponRow,
  isCouponEligiblePackage,
  orderHoldsCoupon,
  parseCouponCode,
  resolveCouponEnv,
  STAGING_TEST_BATCH,
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

// ─────────────────────────────────────────────────────────────
// 새 코드 조회 예산(S2 — docs/coupon-lookup-cap-proposal.md, 사용자 채택 2026-09-11)
//
// 계정 생성 비용이 0 이라(B 결정) 계정당 한도만으로는 합산 상한이 없다 → 계정과 무관한 **등급별 풀**을 둔다.
// 풀이 하나면 무료 계정 몇 개로 전 고객을 막는 DoS 가 되므로, 위조할 수 없는 신호로만 풀을 가른다:
//   paid   = 프로덕션 실결제(fulfilled) 이력 · social = 카카오·구글 신원(user.identities[]) · open = 나머지
// 🔴 user_metadata(카카오 해시 추출 경로)·email_confirmed_at·user_contact.phone 은 사용자가 비용 0 으로
//   채우거나 덮어쓴다 — 등급 판정에 쓰지 않는다(auth-trust-signals 조사).
// ─────────────────────────────────────────────────────────────

/** 주체(소셜 신원, 없으면 계정)당 KST 하루. 적중 포함 — 정상 고객은 코드당 2~3회(렌더·prepare·재렌더). */
export const COUPON_SUBJECT_DAILY_LIMIT = 10;
/** 등급 풀 기본값(KST 하루, production·test 따로). env COUPON_POOL_OPEN/SOCIAL/PAID 로 조정 — 전단 배포일엔 올린다. */
export const COUPON_POOL_DEFAULTS = { open: 20, social: 40, paid: 30 } as const;
export type CouponLookupTier = keyof typeof COUPON_POOL_DEFAULTS;

/** 쿠폰 판정에 필요한 만큼의 로그인 사용자. supabase `getUser()` 의 User 가 그대로 들어온다. */
export interface CouponViewer {
  id: string;
  is_anonymous?: boolean;
  /** 🔴 `getUser()` 에만 있다. `getClaims()`/JWT 로 바꾸면 사라져 전원 open 으로 강등된다(안전 쪽 실패). */
  identities?: ReadonlyArray<{ provider: string; id: string }> | null;
}

function poolLimit(tier: CouponLookupTier): number {
  // 빈 값·공백은 "미설정"(기본값)이다. Number('') 가 0 이라 그대로 두면 값을 비운 순간 풀이 통째로 닫힌다.
  //   닫으려면 '0' 을 명시한다.
  const raw = process.env[`COUPON_POOL_${tier.toUpperCase()}`]?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= 0 ? value : COUPON_POOL_DEFAULTS[tier];
}

/**
 * 카카오·구글 신원 키. 계정 수명과 분리된다 — 탈퇴·재가입해도 같은 카카오/구글이면 같은 키라 한도가 초기화되지 않는다.
 * `id` 는 제공자의 사용자 ID(`identity_id` 가 행 uuid). 카카오 회원번호는 짧은 숫자라 해시가 완전한 비가역은 아니다(uid-hash.ts 와 같은 한계).
 */
function socialSubject(viewer: CouponViewer): string | null {
  const keys = (viewer.identities ?? [])
    .filter((identity) => identity.provider === 'kakao' || identity.provider === 'google')
    .map((identity) => `${identity.provider}:${identity.id}`)
    .sort();
  return keys.length ? createHash('sha256').update(keys[0]).digest('hex') : null;
}

/** 프로덕션 실결제 이력. staging 이 같은 DB 라 샌드박스 결제는 빼고(origin), 환불은 비용을 돌려받으니 뺀다. 조회 실패 = 아님. */
async function hasPaidHistory(service: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await service
    .from('payment_orders')
    .select('metadata')
    .eq('user_id', userId)
    .eq('status', 'fulfilled')
    .gt('amount', 0)
    .limit(20);
  if (error || !data) return false;
  // origin 이 **production** 이거나, origin 기록 자체가 없는 2026-08-29 이전 주문만. 🔴 기록이 'unknown'(허용목록 밖 호스트)인
  //   새 주문은 빼야 한다 — isRealRevenueOrder 는 매출 집계용이라 unknown 을 실매출로 두는데, 그러면 낯선 호스트로 들어온
  //   샌드박스 결제가 비용 0 으로 paid 등급을 얻는다(리뷰 발견 2026-09-11).
  return (data as { metadata?: unknown }[]).some((row) => {
    const origin = (row.metadata as { origin?: unknown } | null)?.origin;
    return origin == null || readPaymentOrigin(row.metadata).env === 'production';
  });
}

/**
 * 새 코드를 조회하기 **전에** 예산을 쓴다. 거부면 사유, 통과면 null.
 * 🔴 조회 전이라 코드가 유효하든 아니든 같은 응답이다 — 한도 뒤에 "맞는 코드만 통과"를 두면 오라클이 다시 열린다.
 * 🔴 실패-닫힘: RPC 오류·null 이면 거부. 막히는 건 새 코드 입력뿐, 결제·등록된 쿠폰은 이 경로를 타지 않는다.
 * 주체 → 풀 순서 — 주체 한도가 찬 공격자가 풀을 태우지 못하게.
 */
async function spendLookupBudget(
  service: SupabaseClient,
  viewer: CouponViewer,
  code: string,
  env: 'production' | 'test',
  now: Date
): Promise<'rate_limited' | 'busy' | null> {
  const period = dailyPeriodKey(now);
  const bucketOf = (name: string) => `coupon:${env}:${name}`;
  const consume = async (name: string, limit: number) => {
    const { data, error } = await service.rpc('consume_rate_counter', {
      p_bucket: bucketOf(name),
      p_period_key: period,
      p_limit: limit,
    });
    return error || typeof data !== 'number' ? null : data;
  };

  const social = socialSubject(viewer);
  const subject = social ? `id:${social}` : `acct:${viewer.id}`;

  // 🔴 같은 (주체, 코드)는 KST 하루 1회만 과금한다(리뷰 발견 2026-09-11). 체크아웃은 탭·앱 복귀 때마다 헤더의
  //   router.refresh() 로 다시 렌더되는데, 매번 과금하면 결제 전에 앱을 오간 정상 고객이 코드 하나로 한도에 걸린다.
  //   같은 질문을 반복해도 새 정보가 없으므로 오라클은 넓어지지 않는다 — 주체 한도는 "서로 다른 코드 10개"가 된다.
  const seen = `seen:${subject}:${code}`;
  const { data: seenRow, error: seenError } = await service
    .from('rate_counters')
    .select('used_count')
    .eq('bucket', bucketOf(seen))
    .eq('period_key', period)
    .maybeSingle();
  if (!seenError && seenRow) return null;

  if ((await consume(subject, COUPON_SUBJECT_DAILY_LIMIT)) == null) return 'rate_limited';
  const tier: CouponLookupTier = (await hasPaidHistory(service, viewer.id)) ? 'paid' : social ? 'social' : 'open';
  const limit = poolLimit(tier);
  const used = await consume(`pool:${tier}`, limit);
  if (used == null) return 'busy';
  // 과금이 **성공한 뒤에만** 표시한다. 거부된 질문을 표시하면 같은 코드를 두 번째 물을 때 공짜로 답을 얻는다(한도 우회).
  //   동시 첫 요청 두 개가 둘 다 과금되는 건 허용한다(과소 과금보다 과다 과금 쪽이 안전하다).
  await consume(seen, 1);
  // 풀이 반·전부 찼을 때 1회씩 알린다(각 값은 하루에 한 요청만 받는다). 운영 대응: 정상 급증이면 노브 상향·그날 행 삭제,
  //   공격이면 배치 disabled_at(080 덕에 정상 고객은 재발행 코드를 쓸 수 있다).
  //   실제 프로덕션 배포에서만 보낸다 — staging·로컬·테스트가 운영 메일함을 채우지 않게.
  const isProductionDeploy = process.env.VERCEL_ENV === 'production';
  if (env === 'production' && isProductionDeploy && (used === Math.ceil(limit / 2) || used === limit)) {
    // 응답 뒤에 보낸다 — 한도에 닿은 그 고객의 요청이 메일 API 를 기다리지 않게.
    after(() => sendOpsAlertEmail({
      subject: `쿠폰 조회 예산 ${used === limit ? '소진' : '50%'} — ${tier} 풀`,
      lines: [
        `오늘(KST ${period}) ${tier} 등급의 새 쿠폰 코드 조회가 ${used}/${limit} 에 닿았습니다.`,
        used === limit
          ? '지금부터 이 등급 고객의 새 코드 입력은 내일 0시까지 막힙니다(등록된 쿠폰·결제는 영향 없음).'
          : '이 속도면 오늘 안에 소진될 수 있습니다.',
        '정상 급증이면 COUPON_POOL_* env 를 올려 재배포하거나 rate_counters 의 오늘 행을 지워 리필하세요. 공격이면 해당 배치를 disabled_at 으로 끄고 재발행하세요.',
      ],
      url: '/admin',
    }).catch(() => undefined));
  }
  return null;
}

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
  /** 🔴 체크아웃·prepare 가 **같은 `getUser()` 결과**를 넘긴다 — 등급(예산 풀)이 갈리면 화면·청구가 어긋난다. */
  viewer: CouponViewer | null,
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
  //   Supabase 익명 로그인(is_anonymous)도 같다 — 지금은 꺼져 있지만 켜지는 순간 무료 계정 공장이 된다.
  if (!viewer || viewer.is_anonymous) return noDiscount(null);
  const userId = viewer.id;

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
    // 새 코드 = 오라클 입구(미리보기·prepare 둘 다 여기를 지난다). 환경을 모르면 어떤 쿠폰도 안 되므로 조회하지 않는다.
    if (!opts.env) return noDiscount('env_mismatch');
    const blocked = await spendLookupBudget(service, viewer, parsed.code, opts.env, now);
    if (blocked) return noDiscount(blocked);
    row = await selectCoupon(service, 'code', parsed.code);
    // 환경이 안 맞는 행(staging 에서 본 실물 코드 등)은 **없는 코드와 같은 답**으로 끝낸다 — 평가·보유자 조회까지 가면
    //   만료 문구·응답 시간으로 존재가 샌다(리뷰 발견 2026-09-11: staging 예산은 프로덕션 풀과 따로라 우회 채널이 된다).
    if (!row || (opts.env === 'production') === (row.batch === STAGING_TEST_BATCH)) {
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
