import assert from 'node:assert/strict';
import { applyPartnerPrice, getActivePartner, normalizePartnerCode } from './partner';

declare const test: (name: string, fn: () => void | Promise<void>) => void;
const terms = { code: 'mina', name: '미나', discountPercent: 40, commissionPercent: 30 };

test('applyPartnerPrice: 32,000 × 40% → 19,200', () => {
  assert.deepEqual(applyPartnerPrice(32000, terms), { chargeAmount: 19200, discountWon: 12800, percent: 40 });
});

test('normalizePartnerCode: 소문자·영숫자 3~20자만', () => {
  assert.equal(normalizePartnerCode(' MiNa01 '), 'mina01');
  assert.equal(normalizePartnerCode('a'), null);
  assert.equal(normalizePartnerCode('mi-na'), null);
  assert.equal(normalizePartnerCode(undefined), null);
});

function fakeService(result: { data: unknown; error: unknown }) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => result };
  return { from: () => q } as never;
}

test('getActivePartner: 활성 파트너면 조건 반환, 비활성·없음·조회 오류면 null', async () => {
  const row = { code: 'mina', name: '미나', discount_percent: 40, commission_percent: 30, active: true };
  assert.deepEqual(await getActivePartner(fakeService({ data: row, error: null }), 'mina'), terms);
  assert.equal(await getActivePartner(fakeService({ data: { ...row, active: false }, error: null }), 'mina'), null);
  assert.equal(await getActivePartner(fakeService({ data: null, error: null }), 'mina'), null);
  assert.equal(await getActivePartner(fakeService({ data: null, error: { message: 'relation does not exist' } }), 'mina'), null);
  assert.equal(await getActivePartner(fakeService({ data: row, error: null }), 'x'), null);
});
