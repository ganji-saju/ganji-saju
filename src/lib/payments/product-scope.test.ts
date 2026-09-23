import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildTasteProductHref } from './post-payment-redirect';
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
import { getPackage, getTasteProductPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('payment scope keys isolate today detail, month, year, and lifetime products', () => {
  assert.equal(buildTodayDetailScopeKey('reading-abc'), 'today:reading-abc');
  // 2026-09-23 — 저장 scope 는 날짜까지(결제 1건 = 이용권 1행). 날짜 없는 형식은 레거시 행 조회·표시용.
  assert.equal(buildTodayDetailScopeKey('reading-abc', '2026-09-23'), 'today:reading-abc:2026-09-23');
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

// 2026-09-14 — 하루 1회 차단 화면에서 온 결제(무료 결과 없음)는 표식을 실어 상세 '돌아가기'가 입력 화면으로 간다.
test('today-detail: 하루 1회 차단 진입(-limit)은 착지에 from=limit — 결제 후·이미 구매·멤버 열기 공통', () => {
  assert.equal(
    buildPurchasedProductHref('today-detail', 'r-1', { from: 'today-fortune-limit', scope: 'general' }),
    '/today-fortune/detail?paid=today-detail&sourceSessionId=r-1&concern=general&from=limit'
  );
  assert.equal(
    buildTasteProductHref('today-detail', 'r-1', 'general', 'start-limit'),
    '/today-fortune/detail?paid=today-detail&concern=general&sourceSessionId=r-1&from=limit'
  );
  assert.ok(!buildTasteProductHref('today-detail', 'r-1', 'general', 'today-fortune')!.includes('from='));
  // 착지 화면이 표식을 받아 돌아가기를 바꾼다(빈 무료 결과 화면 막다른 길 방지).
  const page = fs.readFileSync(path.join(process.cwd(), 'src/app/today-fortune/detail/page.tsx'), 'utf8');
  assert.ok(/backHref=\{from === 'limit' \? '\/today-fortune' : undefined\}/.test(page));
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

// 🔴 2026-09-23 사용자 결정 — 저장되는 당일권 scope 에 KST 날짜가 들어가야 결제 1건 = 이용권 1행이 된다.
//   날짜가 빠지면 UNIQUE(user, product, scope_key) 때문에 다음 날 재구매가 어제 행을 덮어쓰던 옛 동작으로 돌아간다.
test('오늘 자세히 결제 scope 는 사주 + KST 날짜다', async () => {
  const pkg = getTasteProductPackage('today-detail');
  assert.ok(pkg, 'today-detail 패키지가 있어야 함');

  const now = new Date('2026-09-23T02:00:00Z'); // KST 11:00
  const scope = await resolvePaymentProductScope({ pkg, slug: 'reading-abc', scope: null, now });
  assert.ok(scope, 'scope 가 null 이면 권한이 안 생긴다');
  assert.equal(scope.kind, 'today');
  assert.equal(scope.scopeKey, 'today:reading-abc:2026-09-23');

  // KST 자정 경계 — 같은 UTC 날짜라도 KST 로는 다음 날이면 다른 scope(그날 몫)여야 한다.
  const kstNextDay = new Date('2026-09-23T15:00:00Z'); // KST 09-24 00:00
  const next = await resolvePaymentProductScope({ pkg, slug: 'reading-abc', scope: null, now: kstNextDay });
  assert.equal(next?.scopeKey, 'today:reading-abc:2026-09-24');
});

test('buildPurchasedProductHref: 택일 결제 후 복귀는 /taekil', () => {
  assert.equal(buildPurchasedProductHref('taekil', null), '/taekil');
});
