import assert from 'node:assert/strict';
import { getPackage, getTasteProductPackage } from '@/lib/payments/catalog';
import { MEMBER_DISCOUNT_PERCENT_BY_PACKAGE } from '@/lib/payments/member-discount';
import { PARTNER_PACKAGE_ID } from './partner';

declare const test: (name: string, fn: () => void) => void;

test('파트너판: 32,000원 · 신년운세와 같은 이용권 · 멤버십 할인 없음', () => {
  const pkg = getPackage(PARTNER_PACKAGE_ID)!;
  assert.equal(pkg.price, 32000);
  assert.equal(pkg.tasteProductId, 'new-year');
  assert.equal(pkg.requiresSlug, true);
  assert.equal(MEMBER_DISCOUNT_PERCENT_BY_PACKAGE[PARTNER_PACKAGE_ID], undefined);
});

test('파트너판도 tasteProductId new-year — 일반 체크아웃의 new-year 는 여전히 19,900 상품', () => {
  assert.equal(getTasteProductPackage('new-year')?.id, 'taste_new_year_2027');
});
