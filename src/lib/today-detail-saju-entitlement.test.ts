import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { todayDetailRowsOpenSaju } from './product-entitlements';

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

test('여러 건 중 하나라도 이 사주 것이면 열림 · 이용권 없음은 닫힘', () => {
  const current = { readingKey: BOUGHT, slug: null };
  assert.equal(
    todayDetailRowsOpenSaju([row(`today:${FAMILY}`), row(`today:${BOUGHT}`)], DAY, current),
    true
  );
  assert.equal(todayDetailRowsOpenSaju([], DAY, current), false);
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
});
