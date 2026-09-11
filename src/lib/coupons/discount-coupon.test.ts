// 할인쿠폰 순수 로직 고정. 이 파일이 지키는 것은 전부 **돈**이다.
import assert from 'node:assert/strict';
import {
  MAX_DISCOUNT_PERCENT,
  applyCouponDiscount,
  formatCouponCode,
  parseCouponCode,
} from './discount-coupon';

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
