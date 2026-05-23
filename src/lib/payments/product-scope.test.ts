import assert from 'node:assert/strict';
import {
  buildLifetimeReportScopeKey,
  buildMonthlyCalendarScopeKey,
  buildTodayDetailScopeKey,
  buildYearCoreScopeKey,
  getKoreaYear,
  parseLifetimeReportReadingKey,
  parseYearMonthScope,
  parseYearScope,
} from './product-scope';

declare const test: (name: string, fn: () => void) => void;

test('payment scope keys isolate today detail, month, year, and lifetime products', () => {
  assert.equal(buildTodayDetailScopeKey('reading-abc'), 'today:reading-abc');
  assert.equal(buildMonthlyCalendarScopeKey('reading-abc', 2026, 5), 'calendar:reading-abc:2026-05');
  assert.equal(buildMonthlyCalendarScopeKey('reading-abc', 2026, 6), 'calendar:reading-abc:2026-06');
  assert.equal(buildYearCoreScopeKey('reading-abc', 2026), 'year:reading-abc:2026');
  assert.equal(buildYearCoreScopeKey('reading-abc', 2027), 'year:reading-abc:2027');
  assert.equal(buildLifetimeReportScopeKey('reading-abc'), 'lifetime:reading-abc');
});

test('parseLifetimeReportReadingKey reverses the lifetime scope key for refund revocation', () => {
  assert.equal(parseLifetimeReportReadingKey(buildLifetimeReportScopeKey('reading-abc')), 'reading-abc');
  assert.equal(parseLifetimeReportReadingKey('lifetime:reading-abc'), 'reading-abc');
  assert.equal(parseLifetimeReportReadingKey('today:reading-abc'), null);
  assert.equal(parseLifetimeReportReadingKey('global'), null);
  assert.equal(parseLifetimeReportReadingKey(null), null);
  assert.equal(parseLifetimeReportReadingKey(undefined), null);
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
