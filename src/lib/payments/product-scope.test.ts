import assert from 'node:assert/strict';
import {
  buildLifetimeReportScopeKey,
  buildMonthlyCalendarScopeKey,
  buildPurchasedProductHref,
  buildTodayDetailScopeKey,
  buildYearCoreScopeKey,
  getKoreaYear,
  parseLifetimeReportReadingKey,
  parseMonthlyCalendarScopeKey,
  parseYearCoreScopeKey,
  parseYearMonthScope,
  parseYearScope,
  buildDayPassScopeKey,
  resolvePaymentProductScope,
} from './product-scope';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('payment scope keys isolate today detail, month, year, and lifetime products', () => {
  assert.equal(buildTodayDetailScopeKey('reading-abc'), 'today:reading-abc');
  assert.equal(buildMonthlyCalendarScopeKey('reading-abc', 2026, 5), 'calendar:reading-abc:2026-05');
  assert.equal(buildMonthlyCalendarScopeKey('reading-abc', 2026, 6), 'calendar:reading-abc:2026-06');
  assert.equal(buildYearCoreScopeKey('reading-abc', 2026), 'year:reading-abc:2026');
  assert.equal(buildYearCoreScopeKey('reading-abc', 2027), 'year:reading-abc:2027');
});

// 🔴 회귀 가드(2026-07-22) — 이름 해시 드리프트 보정용 파서. 합성 스코프 키에서 readingKey 추출.
//   readingKey(toSlug)는 '-' 구분이라 ':' 를 포함하지 않으므로 가운데가 readingKey, 마지막이 기간.
test('parseYearCoreScopeKey / parseMonthlyCalendarScopeKey — build 역함수 + readingKey 추출', () => {
  const rk = '1990-5-20-14-m30-male-key1abc234'; // 해시 접미사 포함 realistic readingKey
  assert.deepEqual(parseYearCoreScopeKey(buildYearCoreScopeKey(rk, 2026)), {
    readingKey: rk,
    year: 2026,
  });
  assert.deepEqual(parseMonthlyCalendarScopeKey(buildMonthlyCalendarScopeKey(rk, 2026, 5)), {
    readingKey: rk,
    year: 2026,
    month: 5,
  });
  // 잘못된 prefix/형식은 null
  assert.equal(parseYearCoreScopeKey('lifetime:xxx'), null);
  assert.equal(parseYearCoreScopeKey('year:rk'), null); // 기간 세그먼트 없음
  assert.equal(parseMonthlyCalendarScopeKey('calendar:rk:2026'), null); // month 없음(YYYY-MM 아님)
  assert.equal(parseMonthlyCalendarScopeKey(null), null);
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

// 🔴 2026-08-28 — 택일 3,300원 당일권 신설. scope 를 틀리면 돈이 틀린다:
//   global(null)로 새면 3,300원 한 번에 **영구권**이 나가고, 반대로 날짜가 안 맞으면
//   같은 날 재진입에 또 청구된다. 새 당일권을 붙일 때 여기부터 확인한다.
test('택일은 당일권(KST 날짜 scope)으로 결제된다', async () => {
  const pkg = getPackage('taste_taekil');
  assert.ok(pkg, 'taste_taekil 패키지가 있어야 함');
  assert.equal(pkg.price, 3300, '메뉴·체크아웃이 3,300원이라고 말한다');

  const now = new Date('2026-08-28T02:00:00Z'); // KST 11:00 — 같은 날
  const scope = await resolvePaymentProductScope({ pkg, slug: null, scope: null, now });
  assert.ok(scope, '택일 결제 scope 가 null 이면 권한이 안 생긴다');
  assert.equal(scope.productId, 'taekil');
  assert.equal(scope.kind, 'day-pass', 'global 로 새면 3,300원에 영구권이 나간다');
  assert.equal(scope.scopeKey, buildDayPassScopeKey(now));
});

test('buildPurchasedProductHref: 택일 결제 후 복귀는 /taekil', () => {
  assert.equal(buildPurchasedProductHref('taekil', null), '/taekil');
});
