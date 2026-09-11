// 할인쿠폰 순수 로직 고정. 이 파일이 지키는 것은 전부 **돈**이다.
import assert from 'node:assert/strict';
import {
  COUPON_RECLAIM_AFTER_MS,
  MAX_DISCOUNT_PERCENT,
  STAGING_TEST_BATCH,
  applyCouponDiscount,
  resolveCouponEnv,
  type CouponEnv,
  evaluateCouponRow,
  formatCouponCode,
  isCouponEligiblePackage,
  orderHoldsCoupon,
  parseCouponCode,
  type CouponRow,
} from './discount-coupon';
import { PAYMENT_PACKAGES } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void) => void;

test('parseCouponCode — 인쇄형식 ganji-10-0000 을 정규형으로', () => {
  const p = parseCouponCode('ganji-10-0000');
  assert.equal(p?.code, 'ganji100000');
  assert.equal(p?.tier, '10');
  assert.equal(p?.serial, '0000');
});

test('parseCouponCode — 손으로 옮겨 적을 때 생기는 변형을 전부 흡수한다', () => {
  // 하이픈 없음 / 공백 / 대문자 / 앞뒤 공백 — 전단을 보고 타이핑하면 다 나온다.
  for (const raw of ['ganji200137', 'GANJI-20-0137', ' ganji 20 0137 ', 'Ganji_20_0137']) {
    assert.equal(parseCouponCode(raw)?.code, 'ganji200137', raw);
  }
});

test('parseCouponCode — 발행하지 않는 등급·자릿수는 거부한다', () => {
  for (const raw of [
    'ganji-90-0000', // 등급 위조
    'ganji-15-0000', // 5단위가 아닌 등급
    'ganji-10-000', // 3자리
    'ganji-10-00000', // 5자리
    'ganji-10-abcd', // 숫자 아님
    'ganji100000x',
    'gangi-10-0000', // 오타 브랜드
    '',
  ]) {
    assert.equal(parseCouponCode(raw), null, raw);
  }
  assert.equal(parseCouponCode(undefined as unknown as string), null);
});

test('formatCouponCode — 정규형을 인쇄형식으로 되돌린다', () => {
  assert.equal(formatCouponCode('ganji500042'), 'ganji-50-0042');
  // 파싱 불가한 값은 그대로 — 관리자 화면에서 원본을 숨기지 않는다.
  assert.equal(formatCouponCode('???'), '???');
});

test('applyCouponDiscount — 원 단위 절사', () => {
  // 3,300 × 30% = 990 → 2,310
  assert.deepEqual(applyCouponDiscount(3300, 30), {
    percent: 30,
    discountWon: 990,
    chargeAmount: 2310,
  });
  // 3,300 × 10% = 330
  assert.equal(applyCouponDiscount(3300, 10).chargeAmount, 2970);
  // 9,900 × 50% = 4,950
  assert.equal(applyCouponDiscount(9900, 50).chargeAmount, 4950);
  // 49,000 × 50% = 24,500
  assert.equal(applyCouponDiscount(49000, 50).chargeAmount, 24500);
});

test('applyCouponDiscount — 상한 50% 는 입력 검증이 아니라 여기서 자른다', () => {
  // DB 직수정·마이그레이션 실수로 60·100 이 들어와도 청구엔 못 넘어온다.
  for (const bad of [51, 60, 100, 1000]) {
    const r = applyCouponDiscount(3300, bad);
    assert.equal(r.percent, MAX_DISCOUNT_PERCENT, `${bad}% 가 통과하면 안 된다`);
    assert.equal(r.chargeAmount, 1650);
  }
});

test('applyCouponDiscount — 음수·NaN·0 은 할인 없음으로 떨어진다', () => {
  for (const bad of [0, -10, NaN, Infinity]) {
    const r = applyCouponDiscount(3300, bad as number);
    assert.equal(r.discountWon, 0, String(bad));
    assert.equal(r.chargeAmount, 3300);
  }
});

test('applyCouponDiscount — 청구액은 절대 0원이 되지 않는다', () => {
  // payment_orders.amount 에 CHECK (amount > 0) 이 걸려 있어 0원이면 prepare 가 500 이 된다.
  assert.equal(applyCouponDiscount(1, 50).chargeAmount, 1);
  assert.equal(applyCouponDiscount(2, 50).chargeAmount, 1);
  // maxDiscountWon 은 상한일 뿐 할인액을 **늘리지 않는다**(1000×50% = 500 그대로).
  assert.equal(applyCouponDiscount(1000, 50, 999999).chargeAmount, 500);
});

test('applyCouponDiscount — 주문당 할인 상한(max_discount_won)', () => {
  // 49,000 × 50% = 24,500 이지만 상한 5,000 이면 5,000 만 깎인다.
  const r = applyCouponDiscount(49000, 50, 5000);
  assert.equal(r.discountWon, 5000);
  assert.equal(r.chargeAmount, 44000);
  // 상한이 할인액보다 크면 무시된다.
  assert.equal(applyCouponDiscount(3300, 10, 99999).discountWon, 330);
});

// ─────────────────────────────────────────────────────────────
// 귀속·재사용 판정(evaluateCouponRow / orderHoldsCoupon)
// ─────────────────────────────────────────────────────────────

const NOW = new Date('2026-09-11T12:00:00Z');
const HOUR = 60 * 60 * 1000;

function row(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    code: 'ganji300001',
    batch: '2026-09-강남전단',
    bound_user_id: null,
    bound_at: null,
    bound_percent: null,
    bound_max_discount_won: null,
    expires_at: '2027-12-31T14:59:59+00:00',
    disabled_at: null,
    coupon_tiers: { percent: 30, max_discount_won: null, disabled_at: null },
    ...overrides,
  };
}

function evaluate(r: CouponRow, extra: { userId?: string; env?: CouponEnv; live?: boolean } = {}) {
  return evaluateCouponRow({
    row: r,
    userId: extra.userId ?? 'u1',
    now: NOW,
    env: extra.env === undefined ? 'production' : extra.env,
    holderHasLiveOrder: extra.live ?? false,
  });
}

test('evaluateCouponRow — 미귀속 코드는 등급의 **현재** 요율로 최초 귀속', () => {
  assert.deepEqual(evaluate(row()), { ok: true, mode: 'claim', percent: 30, maxDiscountWon: null });
});

// 🔴 설계 §5-2 SQL 은 본인 재사용 때도 bound_percent 를 덮어써서 요율 인하가 기존 고객에게 번졌다.
test('evaluateCouponRow — 본인 재사용은 귀속 스냅샷을 쓴다(관리자가 요율을 내려도 안 깎인다)', () => {
  const bound = row({
    bound_user_id: 'u1',
    bound_at: new Date(NOW.getTime() - 100 * HOUR).toISOString(),
    bound_percent: 30,
    bound_max_discount_won: 5000,
    coupon_tiers: { percent: 10, max_discount_won: 1000, disabled_at: null }, // 관리자가 내림
  });
  assert.deepEqual(evaluate(bound), { ok: true, mode: 'self', percent: 30, maxDiscountWon: 5000 });
});

test('evaluateCouponRow — 만료·회수는 귀속 여부와 무관하게 매번 본다(v1 은 귀속 후 재검사 0)', () => {
  const mine = { bound_user_id: 'u1', bound_at: NOW.toISOString(), bound_percent: 30 };
  assert.deepEqual(evaluate(row({ ...mine, expires_at: NOW.toISOString() })), { ok: false, reason: 'expired' });
  assert.deepEqual(evaluate(row({ ...mine, disabled_at: NOW.toISOString() })), { ok: false, reason: 'disabled' });
  assert.deepEqual(
    evaluate(row({ ...mine, coupon_tiers: { percent: 30, max_discount_won: null, disabled_at: NOW.toISOString() } })),
    { ok: false, reason: 'disabled' }
  );
  // 등급 행이 없으면 요율을 모른다 → 실패-닫힘.
  assert.deepEqual(evaluate(row({ coupon_tiers: null })), { ok: false, reason: 'disabled' });
});

test('evaluateCouponRow — staging-test 배치는 운영에서, 실물 배치는 운영 밖에서 거부(같은 DB 공유)', () => {
  assert.deepEqual(evaluate(row({ batch: STAGING_TEST_BATCH })), { ok: false, reason: 'env_mismatch' });
  assert.deepEqual(evaluate(row(), { env: 'test' }), { ok: false, reason: 'env_mismatch' });
  // batch 가 비어 있는 행도 실물로 취급 — 운영 밖에서 못 쓴다(실패-닫힘).
  assert.deepEqual(evaluate(row({ batch: null }), { env: 'test' }), { ok: false, reason: 'env_mismatch' });
  assert.equal(evaluate(row({ batch: STAGING_TEST_BATCH }), { env: 'test' }).ok, true);
  // 환경을 모르면(null) 어떤 쿠폰도 안 된다.
  assert.deepEqual(evaluate(row(), { env: null }), { ok: false, reason: 'env_mismatch' });
  assert.deepEqual(evaluate(row({ batch: STAGING_TEST_BATCH }), { env: null }), { ok: false, reason: 'env_mismatch' });
});

// 🔴 리뷰 발견(2026-09-11): /api 는 canonical 301 에서 빠져 프로덕션 배포에 *.vercel.app 으로도 닿는다.
//   "운영 호스트가 아니면 테스트"로 두면 그 별칭에서 staging-test 코드가 실결제에 먹힌다.
test('resolveCouponEnv — preview·unknown 은 전부 거부, 프로덕션 배포는 호스트와 무관하게 테스트 코드 거부', () => {
  assert.equal(resolveCouponEnv('production', 'production'), 'production');
  assert.equal(resolveCouponEnv('staging', 'preview'), 'test');
  assert.equal(resolveCouponEnv('local', undefined), 'test');
  assert.equal(resolveCouponEnv('preview', 'production'), null, '프로덕션 배포의 *.vercel.app 별칭');
  assert.equal(resolveCouponEnv('preview', 'preview'), null, 'PR 프리뷰');
  assert.equal(resolveCouponEnv('unknown', undefined), null);
  assert.equal(resolveCouponEnv('staging', 'production'), null, '호스트가 staging 이어도 프로덕션 배포면 테스트 코드 금지');
});

test('evaluateCouponRow — 남의 쿠폰: 24시간 안이면 거부, 지나도 결제 흔적이 있으면 거부', () => {
  const other = (ageMs: number) =>
    row({ bound_user_id: 'u2', bound_at: new Date(NOW.getTime() - ageMs).toISOString(), bound_percent: 30 });
  assert.deepEqual(evaluate(other(23 * HOUR)), { ok: false, reason: 'bound_to_other' });
  assert.deepEqual(evaluate(other(25 * HOUR), { live: true }), { ok: false, reason: 'bound_to_other' });
  assert.deepEqual(evaluate(other(COUPON_RECLAIM_AFTER_MS)), {
    ok: true,
    mode: 'reclaim',
    percent: 30,
    maxDiscountWon: null,
  });
  // bound_at 이 없으면 나이를 모른다 → 쓰던 사람 보호(요구 4).
  assert.deepEqual(evaluate(row({ bound_user_id: 'u2', bound_at: null })), { ok: false, reason: 'bound_to_other' });
});

// 🔴 설계 §5-2 는 막는 상태에서 fulfilled 를 빠뜨렸다 — 결제를 마친 사람의 쿠폰이 24h 뒤 넘어간다.
test('orderHoldsCoupon — 결제가 오간 주문은 전부 쿠폰을 붙잡는다(fulfilled·refunded 포함)', () => {
  const live = NOW.toISOString();
  for (const status of ['in_progress', 'confirmed', 'fulfilling', 'fulfilled', 'fulfillment_failed', 'refunded']) {
    assert.equal(orderHoldsCoupon({ status, expires_at: live }, NOW), true, status);
  }
  for (const status of ['payment_failed', 'canceled', 'expired']) {
    assert.equal(orderHoldsCoupon({ status, expires_at: live }, NOW), false, status);
  }
  // 모르는 상태는 붙잡는 쪽(요구 4 쪽으로 실패-닫힘).
  assert.equal(orderHoldsCoupon({ status: 'something_new', expires_at: null }, NOW), true);
});

test('orderHoldsCoupon — prepared 는 주문 만료(45분) 전까지만 붙잡는다(정산 크론을 기다리지 않는다)', () => {
  assert.equal(orderHoldsCoupon({ status: 'prepared', expires_at: new Date(NOW.getTime() + 60_000).toISOString() }, NOW), true);
  assert.equal(orderHoldsCoupon({ status: 'prepared', expires_at: new Date(NOW.getTime() - 60_000).toISOString() }, NOW), false);
});

test('isCouponEligiblePackage — 전(재화)이 전달물인 상품만 제외된다', () => {
  const excluded = PAYMENT_PACKAGES.filter((pkg) => !isCouponEligiblePackage(pkg)).map((pkg) => pkg.id);
  assert.deepEqual(excluded.sort(), ['credit_100', 'credit_15', 'credit_40', 'taste_dialogue_entry'].sort());
});
