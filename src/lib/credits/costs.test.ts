import assert from 'node:assert/strict';
import { CREDIT_COSTS, COIN_UNIT_KRW, coinCostForPackage, getFeatureCost } from './costs';
import { getPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-07-19 — 전 차감량이 카탈로그 가격과 **끊겨** 있어서 3,300원 이벤트 후에도 10전에
//   얼어붙어 있었다(같은 상품이 카드 3,300원 vs 전 9,900원 상당). 파생이 유지되는지 고정한다.

test('coinCostForPackage: 상품가 ÷ 990 내림, 최소 1전', () => {
  assert.equal(COIN_UNIT_KRW, 990);
  // 9,900원 상품은 기존 정책값 10전을 그대로 재현해야 한다(기존 정책과 무모순).
  const nineNine = getPackage('taste_score_total');
  assert.equal(nineNine?.price, 9900);
  assert.equal(coinCostForPackage('taste_score_total'), 10);
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
