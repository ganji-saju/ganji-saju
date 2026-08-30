import assert from 'node:assert/strict';
import {
  ADMIN_GRANT_PRODUCTS,
  findAdminGrantProduct,
  isYearMonthScope,
  isYearScope,
  SCORE_FACTOR_SCOPES,
} from './product-grant';
import { getPackage, isBundlePackage, isTasteProductPackage } from '@/lib/payments/catalog';
import {
  parseMonthlyCalendarScopeKey,
  parseReadingProductScopeKey,
  parseScoreFactorScopeKey,
  parseYearCoreScopeKey,
  resolvePaymentProductScope,
  buildDayPassScopeKey,
} from '@/lib/payments/product-scope';
import { toSlug } from '@/lib/saju/pillars';

// 2026-08-31 — 어드민 수동 부여의 **조용한 무효화** 가드.
//
//   이 클래스의 버그는 화면에도 로그에도 안 남는다: 이용권 행은 생기고 API 는 200 을
//   돌려주는데, 게이트가 scope_key 를 파싱하지 못해 계속 잠겨 있다.
//   그래서 여기서는 "부여 경로가 만든 scope 를 **게이트의 파서가 실제로 읽는가**" 를 본다.
//   (부여 경로가 결제와 같은 resolvePaymentProductScope 를 쓰는지도 함께 고정된다.)

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const SLUG = toSlug({ year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: 'male' });
const NOW = new Date('2026-08-31T02:00:00Z'); // KST 11:00

test('부여 목록의 packageId 는 전부 실재하는 패키지다', () => {
  for (const p of ADMIN_GRANT_PRODUCTS) {
    const pkg = getPackage(p.packageId);
    assert.ok(pkg, `${p.packageId} 패키지가 카탈로그에 없다`);
    assert.ok(
      isTasteProductPackage(pkg) || isBundlePackage(pkg),
      `${p.packageId} 는 taste_product/bundle 이 아니다 — 부여 라우트가 처리하지 못한다`
    );
  }
  assert.ok(findAdminGrantProduct('taste_compat_reading'), '궁합 깊은 풀이가 목록에 없다');
  assert.equal(findAdminGrantProduct('nope'), undefined);
});

test('판매 중인 유료 taste 상품은 하나도 빠지지 않는다', () => {
  // "모든 메뉴를 부여할 수 있게" 가 요구사항이다. 새 상품이 생기면 여기서 걸린다.
  const listed = new Set(ADMIN_GRANT_PRODUCTS.map((p) => p.packageId));
  const missing: string[] = [];
  for (const pkg of [
    'taste_today_detail', 'taste_today_basic', 'taste_tarot_daily', 'taste_dream_search',
    'taste_dialogue_entry', 'taste_taekil', 'taste_love_question', 'taste_money_pattern',
    'taste_work_flow', 'taste_monthly_calendar', 'taste_year_core', 'taste_score_factor',
    'taste_score_total', 'taste_compat_reading', 'bundle_comprehensive', 'bundle_today_set',
  ]) {
    if (!listed.has(pkg as never)) missing.push(pkg);
  }
  assert.deepEqual(missing, [], `부여 목록에서 빠진 상품: ${missing.join(', ')}`);
});

test('사주 단위 상품의 scope 를 게이트 파서가 읽는다', async () => {
  // score-total — 게이트(resolveScoreTotalUnlockByIdentity)는 'reading:{readingKey}' 를 판다.
  const total = await resolvePaymentProductScope({
    pkg: getPackage('taste_score_total')!,
    slug: SLUG,
    scope: null,
    now: NOW,
  });
  assert.ok(total?.scopeKey, 'score-total scope 가 없다');
  assert.ok(
    parseReadingProductScopeKey(total!.scopeKey),
    `게이트가 못 읽는 scope: ${total!.scopeKey}`
  );

  // today-detail — 'today:{readingKey}'.
  const todayDetail = await resolvePaymentProductScope({
    pkg: getPackage('taste_today_detail')!,
    slug: SLUG,
    scope: null,
    now: NOW,
  });
  assert.ok(todayDetail?.scopeKey?.startsWith('today:'), `today-detail scope: ${todayDetail?.scopeKey}`);
});

test('월간 달력 — 월 scope 를 주지 않으면 게이트가 못 읽는다(부여 경로가 반드시 월을 받는 이유)', async () => {
  const pkg = getPackage('taste_monthly_calendar')!;

  const withMonth = await resolvePaymentProductScope({ pkg, slug: SLUG, scope: '2026-09', now: NOW });
  assert.deepEqual(parseMonthlyCalendarScopeKey(withMonth!.scopeKey)?.year, 2026);
  assert.deepEqual(parseMonthlyCalendarScopeKey(withMonth!.scopeKey)?.month, 9);

  // 🔴 이게 핵심: scope 없이 부여하면 'reading:…' 이 되고 게이트는 null 을 받는다 = 조용히 잠김.
  const withoutMonth = await resolvePaymentProductScope({ pkg, slug: SLUG, scope: null, now: NOW });
  assert.equal(
    parseMonthlyCalendarScopeKey(withoutMonth!.scopeKey),
    null,
    '월 없이도 게이트가 읽힌다면 이 검증(need=reading-month)은 불필요하다 — 규칙이 바뀐 것'
  );
  assert.equal(findAdminGrantProduct('taste_monthly_calendar')!.need, 'reading-month');
});

test('올해 핵심 — 연도 scope 를 게이트 파서가 읽는다', async () => {
  const scope = await resolvePaymentProductScope({
    pkg: getPackage('taste_year_core')!,
    slug: SLUG,
    scope: '2027',
    now: NOW,
  });
  assert.equal(parseYearCoreScopeKey(scope!.scopeKey)?.year, 2027);
  assert.equal(findAdminGrantProduct('taste_year_core')!.need, 'reading-year');
});

test('점수 5요소 — F1~F5 를 각각 줘야 게이트가 읽는다', async () => {
  const pkg = getPackage('taste_score_factor')!;
  for (const factor of SCORE_FACTOR_SCOPES) {
    const scope = await resolvePaymentProductScope({ pkg, slug: SLUG, scope: factor, now: NOW });
    const parsed = parseScoreFactorScopeKey(scope!.scopeKey);
    assert.equal(parsed?.factorId, factor, `${factor} scope 를 게이트가 못 읽는다`);
  }
  // factor 없이 한 번만 부여하면 'reading:…' 이라 5요소 어디에도 매칭되지 않는다.
  const noFactor = await resolvePaymentProductScope({ pkg, slug: SLUG, scope: null, now: NOW });
  assert.equal(parseScoreFactorScopeKey(noFactor!.scopeKey), null);
});

test('전역 상품은 scopeKey null(=global) — 단일 조회 게이트가 global 을 인정한다', async () => {
  // getProductEntitlement 가 .in('scope_key', [요청, 'global']) 로 조회하므로
  // 궁합은 global 부여 한 방으로 모든 커플이 열린다(부여 UI 문구가 그렇게 말한다).
  for (const packageId of ['taste_compat_reading', 'taste_money_pattern', 'taste_work_flow', 'taste_love_question']) {
    const scope = await resolvePaymentProductScope({
      pkg: getPackage(packageId)!,
      slug: null,
      scope: null,
      now: NOW,
    });
    assert.equal(scope?.scopeKey, null, `${packageId} 가 전역이 아니다`);
    assert.equal(findAdminGrantProduct(packageId)!.need, 'none');
  }
});

test('당일권 4종은 오늘(KST) scope — 부여해도 내일은 안 열린다', async () => {
  for (const packageId of ['taste_today_basic', 'taste_tarot_daily', 'taste_dream_search', 'taste_taekil']) {
    const scope = await resolvePaymentProductScope({
      pkg: getPackage(packageId)!,
      slug: null,
      scope: null,
      now: NOW,
    });
    assert.equal(scope?.scopeKey, buildDayPassScopeKey(NOW), `${packageId} 가 당일권이 아니다`);
    // 관리자가 "영구인 줄 알고" 부여하는 걸 막는 문구가 붙어 있어야 한다.
    assert.ok(
      findAdminGrantProduct(packageId)!.note.includes('오늘'),
      `${packageId}: 당일권이라는 설명이 없다`
    );
  }
});

test('대화상담 질문 3회는 이용권이 아니라는 걸 설명이 말한다', () => {
  // 게이트(viewerHasMenuPass 'dialogue')가 전 잔액을 보므로 이용권을 만들면 아무 일도 안 난다.
  const note = findAdminGrantProduct('taste_dialogue_entry')!.note;
  assert.ok(note.includes('전 3개'), `전 지급이라는 설명이 없다: ${note}`);
});

test('월·연 scope 형식 검증', () => {
  assert.equal(isYearMonthScope('2026-09'), true);
  assert.equal(isYearMonthScope('2026-13'), false);
  assert.equal(isYearMonthScope('2026-9'), false);
  assert.equal(isYearMonthScope('2026'), false);
  assert.equal(isYearScope('2026'), true);
  assert.equal(isYearScope('2026-09'), false);
});
