import assert from 'node:assert/strict';
import {
  buildPurchasedProductHref,
  buildLifetimeReportScopeKey,
  buildMonthlyCalendarScopeKey,
  buildTodayDetailScopeKey,
  buildYearCoreScopeKey,
  getKoreaYear,
  parseYearMonthScope,
  parseYearScope,
  resolvePaymentProductScope,
} from './product-scope';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('payment scope keys isolate today detail, month, year, and lifetime products', () => {
  assert.equal(buildTodayDetailScopeKey('reading-abc'), 'today:reading-abc');
  assert.equal(buildMonthlyCalendarScopeKey('reading-abc', 2026, 5), 'calendar:reading-abc:2026-05');
  assert.equal(buildMonthlyCalendarScopeKey('reading-abc', 2026, 6), 'calendar:reading-abc:2026-06');
  assert.equal(buildYearCoreScopeKey('reading-abc', 2026), 'year:reading-abc:2026');
  assert.equal(buildYearCoreScopeKey('reading-abc', 2027), 'year:reading-abc:2027');
  assert.equal(buildLifetimeReportScopeKey('reading-abc'), 'lifetime:reading-abc');
});

test('payment scope parsers reject invalid month and accept yearly products', () => {
  assert.deepEqual(parseYearMonthScope('2026-05'), { year: 2026, month: 5 });
  assert.equal(parseYearMonthScope('2026-13'), null);
  assert.equal(parseYearMonthScope('2026'), null);
  assert.equal(parseYearScope('2026'), 2026);
  assert.equal(parseYearScope('2026-05'), null);
});

test('korea year helper is stable around UTC date boundaries', () => {
  assert.equal(getKoreaYear(new Date('2025-12-31T15:05:00.000Z')), 2026);
});

test('personality compatibility mini uses caller-provided result scope', async () => {
  const pkg = getPackage('taste_personality_compatibility_mini');
  assert.ok(pkg);

  const scope = await resolvePaymentProductScope({
    pkg,
    scope: 'personality-compatibility:abc123',
  });

  assert.equal(scope?.productId, 'personality_compatibility_mini');
  assert.equal(scope?.kind, 'personality-compatibility');
  assert.equal(scope?.scopeKey, 'personality-compatibility:abc123');
  assert.equal(scope?.readingKey, null);
});

test('personality compatibility mini redirects back to the result screen after purchase', () => {
  assert.equal(
    buildPurchasedProductHref('personality_compatibility_mini', null, {
      scope: 'personality-compatibility:abc123',
    }),
    '/compatibility/personality/result?paid=personality_compatibility_mini&scope=personality-compatibility%3Aabc123'
  );
});
