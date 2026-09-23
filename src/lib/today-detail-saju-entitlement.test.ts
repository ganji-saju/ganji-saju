import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseTodayDetailScopeReadingKey, todayDetailRowsOpenSaju } from './product-entitlements';
import { detailReportRowsOpenSaju } from './credits/detail-report-access';

declare const test: (name: string, fn: () => void) => void;

// 2026-09-14 사용자 결정 — 오늘 자세히(3,300원)는 **산 사주만** 열린다.
//   전에는 (user, today-detail, 오늘 created_at) 만 봐서 그날 아무 사주로 1번 사면
//   가족 사주까지 결제 화면·결제 준비·열기에서 열렸다.

const DAY = '2026-09-14';
const TODAY = '2026-09-14T03:00:00.123456+00:00'; // KST 12:00
// 검색/직접입력으로 산 사주(#699 실측 형태)
const BOUGHT = '1975-6-11-14-male-loccustom-lat35p1796-lon129p0756-solarlongitude-keyaaaa1';
// 같은 사람을 프리셋(부산)으로 다시 본 경우 — loc 토큰 자체가 다르다
const SAME_VIA_PRESET = '1975-6-11-14-male-locbusan-solarlongitude-keybbbb2';
// 가족(다른 생년월일)
const FAMILY = '1990-5-3-14-female-locbusan-solarlongitude-keydddd4';

const row = (scope_key: string | null, created_at = TODAY) => ({ scope_key, created_at });

test('같은 사주로 산 오늘 이용권 → 열림', () => {
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}`)], DAY, { readingKey: BOUGHT, slug: 'rid-1' }),
    true
  );
});

test('다른 사주(가족)로 산 오늘 이용권 → 닫힘', () => {
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}`)], DAY, { readingKey: FAMILY, slug: 'rid-2' }),
    false
  );
});

test('출생지 입력 경로(프리셋 vs 검색)만 다른 같은 사주 → 열림(#699 정체성 매칭)', () => {
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}`)], DAY, {
      readingKey: SAME_VIA_PRESET,
      slug: 'rid-3',
    }),
    true
  );
});

test('어제(KST) 산 이용권 → 닫힘 · KST 자정 경계', () => {
  const current = { readingKey: BOUGHT, slug: null };
  // KST 09-13 23:59:59 = UTC 09-13 14:59:59
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}`, '2026-09-13T14:59:59+00:00')], DAY, current),
    false
  );
  // KST 09-14 00:00 = UTC 09-13 15:00
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}`, '2026-09-13T15:00:00+00:00')], DAY, current),
    true
  );
});

test('레거시: 사주로 특정 안 되는 오늘 이용권(scope 없음·옛 readingId 키)은 그날 넓게 연다', () => {
  const current = { readingKey: FAMILY, slug: 'rid-2' };
  assert.equal(todayDetailRowsOpenSaju([row('global')], DAY, current), true);
  assert.equal(todayDetailRowsOpenSaju([row(null)], DAY, current), true);
  assert.equal(
    todayDetailRowsOpenSaju([row('today:bc9963e5-eb00-4d97-8393-c5930273e7d4')], DAY, current),
    true
  );
  // 옛 readingId 키가 지금 보는 slug 와 같으면 당연히 열린다
  assert.equal(
    todayDetailRowsOpenSaju([row('today:rid-2')], DAY, { readingKey: null, slug: 'rid-2' }),
    true
  );
});

test('현재 사주 미해석(readingKey null)이면 넓히지 않는다 — 정확일치(slug)만', () => {
  // 호출부가 키를 못 풀어도(resolveReading null 등) 오늘 산 가족 사주가 열리면 안 된다(리뷰 2026-09-14).
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}`)], DAY, { readingKey: null, slug: 'rid-9' }),
    false
  );
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}`)], DAY, { readingKey: null, slug: BOUGHT }),
    true
  );
});

test('여러 건 중 하나라도 이 사주 것이면 열림 · 이용권 없음은 닫힘', () => {
  const current = { readingKey: BOUGHT, slug: null };
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${FAMILY}`), row(`today:${BOUGHT}`)], DAY, current),
    true
  );
  assert.equal(todayDetailRowsOpenSaju([], DAY, current), false);
});

// 2026-09-23 사용자 결정 — scope 에 KST 날짜(today:<readingKey>:<YYYY-MM-DD>). 결제 1건 = 이용권 1행.
//   날짜는 **구분자**이고 "오늘 것인가" 의 정본은 행의 created_at 이다(어제 행은 어제 기준으로만 열린다).
test('scope 파서: today:<사주>[:<KST 날짜>] 에서 사주만 — 날짜만 뗀다', () => {
  assert.equal(parseTodayDetailScopeReadingKey(`today:${BOUGHT}:2026-09-14`), BOUGHT);
  assert.equal(parseTodayDetailScopeReadingKey(`today:${BOUGHT}`), BOUGHT, '옛 형식(날짜 없음)은 그대로');
  assert.equal(parseTodayDetailScopeReadingKey('today:rid-2:2026-09-14'), 'rid-2', '레거시 readingId scope 도 동일');
  assert.equal(parseTodayDetailScopeReadingKey('global'), '', 'today 가 아닌 scope 는 사주 없음');
  assert.equal(parseTodayDetailScopeReadingKey(null), '');
  // 날짜만 남는 기형 키는 통째로 돌려준다(빈 사주로 오인해 레거시 전면 개방이 되지 않게).
  assert.equal(parseTodayDetailScopeReadingKey('today:2026-09-14'), '2026-09-14');
  // ⚠️ 실측(2026-09-23): 지금은 파서를 빼도 판정 결과가 같다 — fromSlug 가 꼬리 토큰을 무시하고,
  //   해석 실패 행은 레거시 규칙이 어차피 연다. 그래도 저장 형식의 계약이라 여기서 고정한다.
});

test('날짜 붙은 scope 도 사주로 대조한다 — 같은 사주 열림 · 가족 닫힘 · 날짜를 사주로 착각하지 않음', () => {
  const dayScoped = row(`today:${BOUGHT}:${DAY}`);
  assert.equal(todayDetailRowsOpenSaju([dayScoped], DAY, { readingKey: BOUGHT, slug: 'rid-1' }), true);
  // 출생지 경로만 다른 같은 사람(#699 정체성) — 열린다
  assert.equal(todayDetailRowsOpenSaju([dayScoped], DAY, { readingKey: SAME_VIA_PRESET, slug: 'rid-9' }), true);
  assert.equal(todayDetailRowsOpenSaju([dayScoped], DAY, { readingKey: FAMILY, slug: 'rid-2' }), false);
  // 날짜만 떼고 사주를 본다 — 날짜 세그먼트가 readingKey 로 읽히면 해석 실패 → 레거시 규칙으로 가족까지 열렸을 것이다.
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}:2026-01-02`)], DAY, { readingKey: FAMILY, slug: 'rid-2' }),
    false
  );
});

test('판정 정본은 created_at — scope 날짜가 어제여도 오늘 만든 행이면 오늘 열린다(재지급·시차)', () => {
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}:2026-09-13`)], DAY, { readingKey: BOUGHT, slug: 'rid-1' }),
    true
  );
  // 반대로 scope 날짜가 오늘이어도 어제 만든 행이면 오늘은 닫힌다.
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${BOUGHT}:${DAY}`, '2026-09-13T03:00:00+00:00')], DAY, {
      readingKey: BOUGHT,
      slug: 'rid-1',
    }),
    false
  );
});

test('readingKey 에는 ":" 이 없다 — 마지막 ":날짜" 만 떼는 파싱의 전제', () => {
  for (const key of [BOUGHT, SAME_VIA_PRESET, FAMILY, 'bc9963e5-eb00-4d97-8393-c5930273e7d4']) {
    assert.ok(!key.includes(':'), `readingKey 에 ':' 이 생기면 scope 파싱을 바꿔야 한다: ${key}`);
  }
});

// 열기(unlock) 4단계 — 전에는 그날 detail_report 행 아무거나(무료 후속질문 포함)면 'coin-daily' 로 가족 사주까지 열렸다.
const meta = (kind: string, readingKey?: string) => ({ metadata: { kind, readingKey, dayKey: DAY } });

test('열기 4단계: 이 사주의 오늘 열람 행(전·멤버십·카카오 쿠폰)만 연다 · 출생지 경로만 다른 같은 사주 열림', () => {
  const rows = [meta('today_fortune_premium_access', BOUGHT)];
  assert.equal(detailReportRowsOpenSaju(rows, BOUGHT), true);
  assert.equal(detailReportRowsOpenSaju(rows, SAME_VIA_PRESET), true);
  assert.equal(detailReportRowsOpenSaju(rows, FAMILY), false);
  assert.equal(detailReportRowsOpenSaju([meta('detail_report_access', BOUGHT)], SAME_VIA_PRESET), true);
});

test('열기 4단계: 무료 후속질문(today_result_followup)·readingKey 없는 행은 아무 사주도 열지 않는다', () => {
  assert.equal(
    detailReportRowsOpenSaju([{ metadata: { kind: 'today_result_followup', sourceSessionId: 'rid-1' } }], FAMILY),
    false
  );
  assert.equal(detailReportRowsOpenSaju([meta('today_result_followup', FAMILY)], FAMILY), false);
  assert.equal(detailReportRowsOpenSaju([meta('today_fortune_premium_access')], FAMILY), false);
  assert.equal(detailReportRowsOpenSaju([{ metadata: null }], FAMILY), false);
});

// 🔴 가드 — 결제 화면·결제 준비·열기(GET/POST)가 같은 판정 함수를 쓴다.
//   한 곳만 옛 '그날 아무 사주' 판정으로 남으면 화면은 결제하라는데 열기는 열리는 등 어긋난다.
test('세 호출부가 hasTodayDetailEntitlementForSaju 하나로 판정한다', () => {
  const root = path.resolve(__dirname, '..');
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
  const sites: Array<[string, number]> = [
    ['lib/saju/today-detail-access.ts', 1],
    ['app/api/payments/prepare/route.ts', 1],
    ['app/api/today-fortune/unlock/route.ts', 2], // GET + POST
  ];
  for (const [file, count] of sites) {
    const src = read(file);
    assert.equal(
      src.match(/hasTodayDetailEntitlementForSaju\(/g)?.length ?? 0,
      count,
      `${file} 의 판정 호출 수`
    );
    assert.ok(!src.includes('hasTodayDetailEntitlementForDay'), `${file} 에 옛 판정이 남음`);
  }
  assert.ok(
    !read('lib/product-entitlements.ts').includes('hasTodayDetailEntitlementForDay'),
    '옛 판정 함수가 남아 있으면 새 호출부가 다시 쓸 수 있다'
  );
  // 열기의 '그날 아무 행' 폴백(hasTodayFortuneDailyAccess)이 되살아나면 결제 화면과 다시 어긋난다.
  for (const file of ['lib/credits/detail-report-access.ts', 'app/api/today-fortune/unlock/route.ts', 'app/api/today-fortune/unlock/route-helpers.ts']) {
    assert.ok(!read(file).includes('hasTodayFortuneDailyAccess'), `${file} 에 사주 무관 일일 폴백이 남음`);
  }
});
