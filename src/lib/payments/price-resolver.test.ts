import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mergePricesWithDefaults, loadResolvedPrices } from './price-resolver';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function fakeService(rows: unknown[] | null, error: unknown = null): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => Promise.resolve({ data: rows, error });
  return { from: () => chain } as unknown as SupabaseClient;
}

test('mergePricesWithDefaults: 오버라이드 없으면 전 상품 카탈로그 기본가', () => {
  const merged = mergePricesWithDefaults(null);
  const today = getPackage('taste_today_detail');
  assert.equal(merged.get('taste_today_detail')?.price, today?.price);
  assert.equal(merged.get('taste_today_detail')?.previousPrice, null);
  // 카탈로그 전 상품이 포함된다.
  assert.equal(merged.has('membership_premium'), true);
});

test('mergePricesWithDefaults: DB 행이 카탈로그 기본가를 오버라이드', () => {
  const merged = mergePricesWithDefaults([
    { package_id: 'taste_today_detail', price: 12000, previous_price: 9900 },
  ]);
  assert.equal(merged.get('taste_today_detail')?.price, 12000);
  assert.equal(merged.get('taste_today_detail')?.previousPrice, 9900);
  // 오버라이드 안 된 상품은 여전히 카탈로그 기본가.
  assert.equal(merged.get('membership_premium')?.price, getPackage('membership_premium')?.price);
});

test('mergePricesWithDefaults: 카탈로그에 없는 package_id 는 무시', () => {
  const merged = mergePricesWithDefaults([
    { package_id: 'ghost_pack', price: 100, previous_price: null },
  ]);
  assert.equal(merged.has('ghost_pack' as never), false);
});

test('loadResolvedPrices: DB 오류면 카탈로그 폴백', async () => {
  const merged = await loadResolvedPrices(fakeService(null, { message: 'boom' }));
  assert.equal(merged.get('taste_today_detail')?.price, getPackage('taste_today_detail')?.price);
});

test('loadResolvedPrices: DB 행 반영', async () => {
  const merged = await loadResolvedPrices(
    fakeService([{ package_id: 'credit_15', price: 8000, previous_price: null }])
  );
  assert.equal(merged.get('credit_15')?.price, 8000);
});
