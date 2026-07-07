import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listProductPrices, validatePriceInput } from './product-pricing';
import { getPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function fakeList(rows: unknown[]): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => Promise.resolve({ data: rows, error: null });
  return { from: () => chain } as unknown as SupabaseClient;
}

test('listProductPrices: 오버라이드 없으면 카탈로그 기본가 + isOverridden=false', async () => {
  const rows = await listProductPrices(fakeList([]));
  const today = rows.find((r) => r.packageId === 'taste_today_detail');
  assert.equal(today?.price, getPackage('taste_today_detail')?.price);
  assert.equal(today?.isOverridden, false);
  assert.equal(rows.length >= 16, true); // 전 카탈로그 상품.
});

test('listProductPrices: DB 오버라이드 반영 + isOverridden=true', async () => {
  const rows = await listProductPrices(
    fakeList([
      {
        package_id: 'taste_today_detail',
        price: 12000,
        previous_price: 9900,
        updated_at: '2026-07-07T00:00:00Z',
      },
    ])
  );
  const today = rows.find((r) => r.packageId === 'taste_today_detail');
  assert.equal(today?.price, 12000);
  assert.equal(today?.previousPrice, 9900);
  assert.equal(today?.isOverridden, true);
});

test('validatePriceInput: 정상', () => {
  const r = validatePriceInput({ packageId: 'credit_15', price: 8000, previousPrice: 9900 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.price, 8000);
});

test('validatePriceInput: 미존재 packageId 거부', () => {
  assert.equal(validatePriceInput({ packageId: 'ghost', price: 100 }).ok, false);
});

test('validatePriceInput: 0/음수/소수 price 거부', () => {
  assert.equal(validatePriceInput({ packageId: 'credit_15', price: 0 }).ok, false);
  assert.equal(validatePriceInput({ packageId: 'credit_15', price: -1 }).ok, false);
  assert.equal(validatePriceInput({ packageId: 'credit_15', price: 9.9 }).ok, false);
});

test('validatePriceInput: previousPrice 빈값이면 null 허용', () => {
  const r = validatePriceInput({ packageId: 'credit_15', price: 8000, previousPrice: '' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.previousPrice, null);
});
