import assert from 'node:assert/strict';
import {
  buildPriceDisplayMap,
  priceLabelFromMap,
  compareLabelFromMap,
  priceValueFromMap,
} from './price-display';
import { mergePricesWithDefaults } from './price-resolver';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('buildPriceDisplayMap: 오버라이드 없으면 카탈로그 기본가 라벨', () => {
  const map = buildPriceDisplayMap(mergePricesWithDefaults(null));
  assert.equal(map['taste_today_detail'].value, getPackage('taste_today_detail')?.price);
  assert.equal(map['taste_today_detail'].label, '9,900원');
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
  // compareAt 없는 상품은 null.
  assert.equal(map['taste_today_detail'].compareValue, null);
  assert.equal(map['taste_today_detail'].compareLabel, null);
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

test('compareLabelFromMap: 없는 상품 null', () => {
  const map = buildPriceDisplayMap(mergePricesWithDefaults(null));
  assert.equal(compareLabelFromMap(map, 'taste_love_question'), null);
});
