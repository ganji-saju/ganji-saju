import assert from 'node:assert/strict';
import { applyPromoPrice, findPromoCode } from './promo-code';

declare const test: (name: string, fn: () => void) => void;

test('전단지 공용 코드: 신년운세 19,900 → 9,900, 띄어쓰기·자모 분리 입력도 같은 코드', () => {
  const promo = findPromoCode('간지사주50', 'taste_new_year_2027', 19900);
  assert.ok(promo);
  assert.deepEqual(applyPromoPrice(19900, promo), { chargeAmount: 9900, discountWon: 10000, percent: 50 });
  assert.ok(findPromoCode(' 간지 사주 50 ', 'taste_new_year_2027', 19900));
  assert.ok(findPromoCode('간지사주50'.normalize('NFD'), 'taste_new_year_2027', 19900));
});

test('전단지 공용 코드: 다른 상품·다른 코드·정가가 더 싸면 적용 안 함', () => {
  assert.equal(findPromoCode('간지사주50', 'taste_dialogue_entry', 19900), null);
  assert.equal(findPromoCode('간지사주5', 'taste_new_year_2027', 19900), null);
  assert.equal(findPromoCode('간지사주50', 'taste_new_year_2027', 9900), null);
  assert.equal(findPromoCode('', 'taste_new_year_2027', 19900), null);
});
