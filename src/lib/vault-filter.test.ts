import assert from 'node:assert/strict';
import {
  isVaultFilterKey,
  normalizeVaultFilter,
  vaultCategoryForProductId,
  visibleVaultFilters,
} from './vault-filter';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-06-05 #2 (보관함 탭 무반응) — 필터값이 데이터에 배선되지 않아 어떤 탭을 눌러도
//   목록이 동일했다. 카테고리 분류 + 동적 탭(데이터 있는 탭만 노출, 타로 제외) 순수 로직.

test('vaultCategoryForProductId: today-detail → today(오늘운세)', () => {
  assert.equal(vaultCategoryForProductId('today-detail'), 'today');
});

test('vaultCategoryForProductId: love-question → gunghap(궁합)', () => {
  assert.equal(vaultCategoryForProductId('love-question'), 'gunghap');
});

test('vaultCategoryForProductId: 사주 파생 상품(평생/월간/연간/재물/직업/미상) → saju', () => {
  for (const productId of [
    'lifetime-report',
    'monthly-calendar',
    'year-core',
    'money-pattern',
    'work-flow',
    'unknown-product',
  ]) {
    assert.equal(vaultCategoryForProductId(productId), 'saju');
  }
});

test('isVaultFilterKey: 타로는 보관함 탭이 아니므로 false', () => {
  assert.equal(isVaultFilterKey('all'), true);
  assert.equal(isVaultFilterKey('saju'), true);
  assert.equal(isVaultFilterKey('today'), true);
  assert.equal(isVaultFilterKey('gunghap'), true);
  assert.equal(isVaultFilterKey('tarot'), false);
  assert.equal(isVaultFilterKey(undefined), false);
});

test('normalizeVaultFilter: 유효 키는 유지, 그 외(타로/빈값/invalid)는 all 로 폴백', () => {
  assert.equal(normalizeVaultFilter('today'), 'today');
  assert.equal(normalizeVaultFilter('gunghap'), 'gunghap');
  assert.equal(normalizeVaultFilter('saju'), 'saju');
  assert.equal(normalizeVaultFilter('all'), 'all');
  assert.equal(normalizeVaultFilter('tarot'), 'all');
  assert.equal(normalizeVaultFilter(undefined), 'all');
  assert.equal(normalizeVaultFilter('xyz'), 'all');
});

test('visibleVaultFilters: 전체 + 데이터 있는 카테고리만(타로 항상 제외)', () => {
  assert.deepEqual(
    visibleVaultFilters(['saju', 'today']).map((f) => f.key),
    ['all', 'saju', 'today']
  );
  assert.deepEqual(
    visibleVaultFilters(['gunghap']).map((f) => f.key),
    ['all', 'gunghap']
  );
  // 순서는 항상 전체 → 사주 → 오늘운세 → 궁합 (정의 순서 유지)
  assert.deepEqual(
    visibleVaultFilters(['gunghap', 'today', 'saju']).map((f) => f.key),
    ['all', 'saju', 'today', 'gunghap']
  );
  assert.deepEqual(
    visibleVaultFilters([]).map((f) => f.key),
    ['all']
  );
});
