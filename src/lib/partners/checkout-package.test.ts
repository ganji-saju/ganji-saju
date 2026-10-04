import assert from 'node:assert/strict';
import { getPackage } from '@/lib/payments/catalog';
import { resolveCheckoutPackage } from './checkout-package';

declare const test: (name: string, fn: () => void) => void;
const terms = { code: 'mina', name: '미나', discountPercent: 40, commissionPercent: 30 };
const NEW_YEAR = getPackage('taste_new_year_2027')!;

test('checkout package: 활성 파트너면 파트너판, 쿠키 없음·비활성(null)이면 일반 신년운세', () => {
  assert.equal(resolveCheckoutPackage(NEW_YEAR, terms).id, 'taste_new_year_2027_partner');
  assert.equal(resolveCheckoutPackage(NEW_YEAR, null).id, 'taste_new_year_2027');
  const other = getPackage('taste_today_detail')!;
  assert.equal(resolveCheckoutPackage(other, terms).id, 'taste_today_detail', '다른 상품엔 파트너판 없음');
});
