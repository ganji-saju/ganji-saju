import assert from 'node:assert/strict';
import {
  buildLifetimeReportScopeKey,
  buildMonthlyCalendarScopeKey,
  buildPurchasedProductHref,
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

// Bug fix — 결제(today-detail) 열람 redirect 가 선택한 고민(scope=concernId)을 안 실어
//   어떤 고민을 골라도 'general' 로 열리던 버그. scope 를 concern 쿼리로 복원.
test('buildPurchasedProductHref: today-detail 은 scope(=concernId)를 concern 으로 복원한다', () => {
  const href = buildPurchasedProductHref('today-detail', 'sess-1', { scope: 'money_spend' });
  assert.ok(href.startsWith('/today-fortune/detail?paid=today-detail'), `경로 유지: ${href}`);
  assert.ok(href.includes('sourceSessionId=sess-1'), `sourceSessionId 포함: ${href}`);
  assert.ok(href.includes('concern=money_spend'), `concern 복원: ${href}`);
});

test('buildPurchasedProductHref: today-detail scope 없으면 concern 미부착(현행 호환)', () => {
  assert.equal(
    buildPurchasedProductHref('today-detail', 'sess-1', {}),
    '/today-fortune/detail?paid=today-detail&sourceSessionId=sess-1'
  );
});

test('buildPurchasedProductHref: today-detail from=saju 는 사주 경로 유지(이번 수정 영향 없음)', () => {
  assert.equal(
    buildPurchasedProductHref('today-detail', 'sess-1', { from: 'saju', scope: 'love_play' }),
    '/saju/sess-1/today-detail'
  );
});
