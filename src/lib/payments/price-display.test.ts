import assert from 'node:assert/strict';
import {
  buildPriceDisplayMap,
  priceLabelFromMap,
  compareLabelFromMap,
  priceValueFromMap,
} from './price-display';
import { mergePricesWithDefaults } from './price-resolver';
import {
  formatWon,
  getPackage,
  PAYMENT_PACKAGES,
  type PackageId,
  type PaymentPackage,
} from './catalog';

/** compareAt(취소선)이 없는 상품을 카탈로그에서 찾는다 — fixture 를 상품명으로 박지 않기 위해. */
function packageWithoutCompareAt(): PackageId {
  const found = (PAYMENT_PACKAGES as readonly PaymentPackage[]).find(
    (pkg) => pkg.compareAt === undefined
  );
  assert.ok(found, '취소선 없는 상품이 카탈로그에 하나는 있어야 이 테스트가 성립한다');
  return found.id as PackageId;
}

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-07-18 — 아래 테스트들이 '9,900원' 같은 **가격 리터럴**을 직접 단언하고 있었다.
//   3,300원 이벤트로 4건이 한꺼번에 깨졌는데, 실제로 검증하려는 건 "카탈로그 값이 라벨로
//   흘러가는가"이지 특정 금액이 아니다. 마케팅 값이 바뀔 때마다 무관한 테스트가 깨지지
//   않도록 카탈로그를 기준으로 단언한다. compareAt 유무 fixture 도 마찬가지 이유로
//   compareAt 유무 fixture 도 특정 상품 이름으로 박지 말 것 — 2026-07-19 에 실제로
//   taste_money_pattern 이 이벤트 대상이 되면서 두 테스트가 깨졌다. 카탈로그에서
//   조건에 맞는 상품을 **찾아서** 쓴다(마케팅이 무엇을 할인하든 안 깨진다).
test('buildPriceDisplayMap: 오버라이드 없으면 카탈로그 기본가 라벨', () => {
  const map = buildPriceDisplayMap(mergePricesWithDefaults(null));
  const catalogPrice = getPackage('taste_today_detail')?.price;
  assert.equal(map['taste_today_detail'].value, catalogPrice);
  assert.equal(map['taste_today_detail'].label, formatWon(catalogPrice as number));
});

test('buildPriceDisplayMap: 구독은 월 접두', () => {
  const map = buildPriceDisplayMap(mergePricesWithDefaults(null));
  assert.equal(map['membership_premium'].label, '월 49,000원');
});

test('buildPriceDisplayMap: compareAt = previous_price ?? catalog.compareAt', () => {
  const map = buildPriceDisplayMap(mergePricesWithDefaults(null));
  // lifetime_report 는 catalog.compareAt=69000 시드.
  assert.equal(map['lifetime_report'].compareValue, 69000);
  assert.equal(map['lifetime_report'].compareLabel, '69,000원');
  // compareAt 없는 상품은 null. 상품명을 박지 않고 카탈로그에서 찾는다.
  const noCompare = packageWithoutCompareAt();
  assert.equal(map[noCompare].compareValue, null);
  assert.equal(map[noCompare].compareLabel, null);
  // 이벤트 상품은 catalog.compareAt 이 그대로 취소선 원가로 노출된다.
  assert.equal(
    map['taste_today_detail'].compareValue,
    getPackage('taste_today_detail')?.compareAt ?? null
  );
});

test('buildPriceDisplayMap: DB previous_price 가 catalog.compareAt 를 오버라이드', () => {
  const map = buildPriceDisplayMap(
    mergePricesWithDefaults([
      { package_id: 'lifetime_report', price: 49000, previous_price: 59000 },
    ])
  );
  assert.equal(map['lifetime_report'].compareValue, 59000);
});

test('buildPriceDisplayMap: DB price 오버라이드가 label 에 반영', () => {
  const map = buildPriceDisplayMap(
    mergePricesWithDefaults([
      { package_id: 'taste_today_detail', price: 12000, previous_price: null },
    ])
  );
  assert.equal(map['taste_today_detail'].label, '12,000원');
});

test('priceLabelFromMap: 특수키 saju_entry → today_detail', () => {
  const map = buildPriceDisplayMap(mergePricesWithDefaults(null));
  assert.equal(priceLabelFromMap(map, 'saju_entry'), map['taste_today_detail'].label);
  assert.equal(priceValueFromMap(map, 'saju_entry'), map['taste_today_detail'].value);
});

test('compareLabelFromMap: compareAt 없는 상품 null', () => {
  const map = buildPriceDisplayMap(mergePricesWithDefaults(null));
  assert.equal(compareLabelFromMap(map, packageWithoutCompareAt()), null);
});
