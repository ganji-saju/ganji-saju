// Phase 3-C-1 (2026-05-18): 결제 동의 매핑 검증.
import assert from 'node:assert/strict';
import {
  findMissingConsents,
  getConsentItems,
  getRequiredConsentKinds,
} from './consent';
import { getPackage } from './catalog';
import type { PolicyKind } from '@/shared/policies/types';

declare const test: (name: string, fn: () => void) => void;

function pkg(id: string) {
  const p = getPackage(id);
  if (!p) throw new Error(`fixture pkg ${id} 없음`);
  return p;
}

test('getRequiredConsentKinds — 공통 3 (terms/privacy/refund) 모든 종류 포함', () => {
  for (const id of ['credit_15', 'subscription_30', 'lifetime_report', 'taste_today_detail']) {
    const required = getRequiredConsentKinds(pkg(id));
    assert.ok(required.includes('terms'), `${id}: terms 누락`);
    assert.ok(required.includes('privacy'), `${id}: privacy 누락`);
    assert.ok(required.includes('refund'), `${id}: refund 누락`);
  }
});

test('getRequiredConsentKinds — credits 종류 = + coin', () => {
  const required = getRequiredConsentKinds(pkg('credit_15'));
  assert.ok(required.includes('coin'));
  assert.equal(required.length, 4); // terms + privacy + refund + coin
});

test('getRequiredConsentKinds — one-time 36 coin package = + coin, not subscription', () => {
  const required = getRequiredConsentKinds(pkg('subscription_30'));
  assert.ok(required.includes('coin'));
  assert.equal(required.includes('subscription'), false);
  assert.equal(required.length, 4);
});

test('getRequiredConsentKinds — managed subscription 종류 = + subscription', () => {
  const required = getRequiredConsentKinds(pkg('membership_premium'));
  assert.ok(required.includes('subscription'));
  assert.equal(required.includes('coin'), false);
  assert.equal(required.length, 4);
});

test('getRequiredConsentKinds — lifetime_report = + digital-content', () => {
  const required = getRequiredConsentKinds(pkg('lifetime_report'));
  assert.ok(required.includes('digital-content'));
  assert.equal(required.length, 4);
});

test('getRequiredConsentKinds — taste_product = + digital-content', () => {
  const required = getRequiredConsentKinds(pkg('taste_today_detail'));
  assert.ok(required.includes('digital-content'));
  assert.equal(required.length, 4);
});

test('getRequiredConsentKinds — bundle = + digital-content', () => {
  const required = getRequiredConsentKinds(pkg('bundle_today_set'));
  assert.ok(required.includes('digital-content'));
  assert.equal(required.length, 4);
});

test('getConsentItems — 각 항목에 kind/label/description 포함', () => {
  const items = getConsentItems(pkg('subscription_30'));
  assert.equal(items.length, 4);
  for (const item of items) {
    assert.ok(item.kind);
    assert.ok(item.label && item.label.length > 0);
    assert.ok(item.description && item.description.length > 0);
  }
});

test('findMissingConsents — 모두 동의 시 빈 배열', () => {
  const p = pkg('credit_15');
  const required = getRequiredConsentKinds(p);
  const missing = findMissingConsents(p, required);
  assert.deepEqual(missing, []);
});

test('findMissingConsents — 일부 누락 시 누락 항목 반환', () => {
  const p = pkg('membership_premium');
  const accepted: PolicyKind[] = ['terms', 'privacy']; // refund / subscription 누락
  const missing = findMissingConsents(p, accepted);
  assert.ok(missing.includes('refund'));
  assert.ok(missing.includes('subscription'));
  assert.equal(missing.length, 2);
});

test('findMissingConsents — 빈 동의 시 전체 누락', () => {
  const p = pkg('lifetime_report');
  const missing = findMissingConsents(p, []);
  assert.equal(missing.length, 4);
});

test('findMissingConsents — 불필요한 동의 추가는 OK (필수만 검사)', () => {
  const p = pkg('credit_15');
  const accepted: PolicyKind[] = ['terms', 'privacy', 'refund', 'coin', 'subscription'];
  const missing = findMissingConsents(p, accepted);
  assert.deepEqual(missing, []);
});
