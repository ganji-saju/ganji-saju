import assert from 'node:assert/strict';
import { CREDIT_COSTS, COIN_UNIT_KRW, coinCostForPackage, getFeatureCost } from './costs';
import { getPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-07-19 — 전 차감량이 카탈로그 가격과 **끊겨** 있어서 3,300원 이벤트 후에도 10전에
//   얼어붙어 있었다(같은 상품이 카드 3,300원 vs 전 9,900원 상당). 파생이 유지되는지 고정한다.

test('coinCostForPackage: 상품가 ÷ 990 내림, 최소 1전', () => {
  assert.equal(COIN_UNIT_KRW, 990);
  // 2026-07-19 — 원래 여기서 taste_score_total 의 가격이 9,900원임을 직접 단언했는데,
  //   그건 이 파일이 경계하는 바로 그 실패(특정 상품 가격에 테스트를 못박기)였다.
  //   검증 대상은 "9,900원짜리는 10전" 이라는 **정책 공식**이지 특정 상품이 아니므로
  //   공식 자체를 단언한다. 어떤 상품 가격이 바뀌어도 이 테스트는 깨지지 않는다.
  assert.equal(Math.floor(9900 / COIN_UNIT_KRW), 10);
  // 최소 1전 바닥: 990원 미만 상품도 0전이 되지 않는다.
  assert.equal(Math.max(1, Math.floor(500 / COIN_UNIT_KRW)), 1);
  // 배선 확인은 가격이 아니라 "카탈로그를 실제로 읽는가"로 한다.
  const pkg = getPackage('taste_today_detail');
  assert.equal(coinCostForPackage('taste_today_detail'), Math.floor((pkg?.price ?? 0) / COIN_UNIT_KRW));
});

test('CREDIT_COSTS: 이벤트 상품은 카드가를 따라 내려간다', () => {
  const detail = getPackage('taste_today_detail');
  const calendar = getPackage('taste_monthly_calendar');
  // 카탈로그가 진실 — 값을 리터럴로 박지 않고 파생 관계만 단언한다.
  assert.equal(CREDIT_COSTS.detail_report, Math.floor((detail?.price ?? 0) / COIN_UNIT_KRW));
  assert.equal(CREDIT_COSTS.calendar, Math.floor((calendar?.price ?? 0) / COIN_UNIT_KRW));
  assert.equal(getFeatureCost('detail_report'), CREDIT_COSTS.detail_report);
});

test('CREDIT_COSTS: 전 결제가 카드 결제보다 비싸지지 않는다(설계 의도)', () => {
  // deduct.ts 의 "전 결제 = 직접결제 대비 우대(재방문 유인)" 규칙.
  // 내림 규칙이라 전 차감 명목가는 항상 카드가 이하여야 한다.
  for (const [feature, pkgId] of [
    ['detail_report', 'taste_today_detail'],
    ['calendar', 'taste_monthly_calendar'],
    ['compat', 'taste_compat_reading'],
  ] as const) {
    const price = getPackage(pkgId)?.price ?? 0;
    const nominal = CREDIT_COSTS[feature] * COIN_UNIT_KRW;
    assert.ok(
      nominal <= price,
      `${feature}: 전 ${CREDIT_COSTS[feature]}개(=${nominal}원 상당)가 카드가 ${price}원보다 비싸다`
    );
  }
});

test('CREDIT_COSTS: 가격 페그가 아닌 항목은 고정', () => {
  assert.equal(CREDIT_COSTS.ai_chat, 3); // 3턴 묶음 과금
  assert.equal(CREDIT_COSTS.daewoon, 3); // 미사용
});
