import assert from 'node:assert/strict';
import { resolveEntitlementRevokeQuery } from './product-entitlements';
import { buildLifetimeReportScopeKey, buildTodayDetailScopeKey } from './payments/product-scope';

declare const test: (name: string, fn: () => void) => void;

// 환불 회수가 legacy credit_transactions grant 행을 정확히 겨냥하는지 검증한다.
// 회수가 grant 와 어긋나면 product_entitlements 만 지워지고 legacy 행이 남아
// 조회 2순위(getLifetimeReportEntitlement / getLegacyTasteProductEntitlement)에서
// 권한이 되살아나 "환불 후에도 열람 가능" 회귀가 난다. 아래 기대값은 grant 경로
// (recordLegacyLifetimeReportTransaction / recordLegacyTasteProductTransaction)가
// 저장하는 (feature, metadata.kind, 식별자)와 대칭이어야 한다.

test('revoke query targets lifetime grant by feature + kind + readingKey', () => {
  const query = resolveEntitlementRevokeQuery(
    'lifetime-report',
    buildLifetimeReportScopeKey('reading-abc')
  );
  assert.equal(query.legacyFeature, 'lifetime_report');
  assert.deepEqual(query.legacyMatch, { kind: 'lifetime_report', readingKey: 'reading-abc' });
});

test('revoke query falls back to kind-only when lifetime scope key is malformed', () => {
  const query = resolveEntitlementRevokeQuery('lifetime-report', 'global');
  assert.equal(query.legacyFeature, 'lifetime_report');
  assert.deepEqual(query.legacyMatch, { kind: 'lifetime_report' });
});

test('revoke query targets taste grant by feature + kind + productId + scopeKey', () => {
  const query = resolveEntitlementRevokeQuery('today-detail', buildTodayDetailScopeKey('reading-abc'));
  assert.equal(query.legacyFeature, 'taste_product');
  assert.deepEqual(query.legacyMatch, {
    kind: 'taste_product',
    productId: 'today-detail',
    scopeKey: 'today:reading-abc',
  });
});
