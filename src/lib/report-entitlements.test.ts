import assert from 'node:assert/strict';
import test from 'node:test';
import type { BirthInput } from '@/lib/saju/types';
import { toSlug } from '@/lib/saju/pillars';
import { buildLifetimeReportScopeKey } from '@/lib/payments/product-scope';
import { sajuIdentityFromReadingKey } from '@/lib/saju/reading-identity';
import {
  matchesEntitlementReadingKey,
  normalizeEntitlementReadingKeys,
  lifetimeReadingKeyMatches,
} from './report-entitlements';

test('normalizeEntitlementReadingKeys keeps canonical first and de-duplicates legacy aliases', () => {
  assert.deepEqual(
    normalizeEntitlementReadingKeys('1982-1-29-8-male-key12wkkzj', [
      'bc9963e5-eb00-4d97-8393-c5930273e7d4',
      '1982-1-29-8-male',
      '  ',
      null,
      undefined,
      'bc9963e5-eb00-4d97-8393-c5930273e7d4',
    ]),
    [
      '1982-1-29-8-male-key12wkkzj',
      '1982-1-29-8-male',
      'bc9963e5-eb00-4d97-8393-c5930273e7d4',
    ]
  );
});

test('matchesEntitlementReadingKey accepts both canonical and legacy aliases', () => {
  const acceptedKeys = normalizeEntitlementReadingKeys('1982-1-29-8-male', [
    'bc9963e5-eb00-4d97-8393-c5930273e7d4',
  ]);

  assert.equal(matchesEntitlementReadingKey('1982-1-29-8-male', acceptedKeys), true);
  assert.equal(
    matchesEntitlementReadingKey('bc9963e5-eb00-4d97-8393-c5930273e7d4', acceptedKeys),
    true
  );
  assert.equal(matchesEntitlementReadingKey('different-reading-key', acceptedKeys), false);
});

// 🔴 회귀 가드(2026-07-21) — "평생/보관형 리포트 구매했는데 상세에서 PDF·본문이 안 보임".
//   근본원인: toSlug 의 해시 토큰(-key<hash>)이 이름을 포함(buildBirthSlugHashPayload).
//   구매(이름 있는 readingId/어드민 grant)와 열람(이름 없는 raw slug)에서 readingKey 가 갈려
//   product_entitlements 정확일치 조회가 MISS → hasLifetimeAccess=false.
//   같은 출생정보면 사주 차트·풀이 내용은 이름과 무관하게 동일하므로, 이름 해시 드리프트는
//   같은 차트 안에서 흡수한다(withoutHash prefix 비교).
const REPRO_BASE: BirthInput = { year: 1990, month: 5, day: 20, hour: 14, minute: 30, gender: 'male' };
const REPRO_WITH_NAME: BirthInput = { ...REPRO_BASE, name: '홍길동' };
const REPRO_WITHOUT_NAME: BirthInput = { ...REPRO_BASE };

test('재현: 이름 유무로 readingKey(해시)가 갈린다 — 같은 차트 prefix', () => {
  const grantKey = toSlug(REPRO_WITH_NAME);
  const readKey = toSlug(REPRO_WITHOUT_NAME);
  assert.notEqual(grantKey, readKey, '이름 유무로 키가 갈려야 버그가 재현됨');
  assert.equal(
    grantKey.replace(/-key[0-9a-z]+$/i, ''),
    readKey.replace(/-key[0-9a-z]+$/i, ''),
    '해시 접미사를 벗기면 동일한 차트 prefix'
  );
});

test('재현: 정확일치만 하면 저장 스코프를 못 잡는다(MISS)', () => {
  const storedScope = buildLifetimeReportScopeKey(toSlug(REPRO_WITH_NAME));
  const readKey = toSlug(REPRO_WITHOUT_NAME);
  const acceptedScopes = normalizeEntitlementReadingKeys(readKey, [readKey]).map(
    buildLifetimeReportScopeKey
  );
  assert.ok(
    !acceptedScopes.includes(storedScope),
    '이름 드리프트에서는 정확일치 조회가 반드시 MISS(=버그)'
  );
});

test('수정: lifetimeReadingKeyMatches 가 이름 해시 드리프트를 흡수한다', () => {
  const grantKey = toSlug(REPRO_WITH_NAME); // 저장(이름 포함)
  const readKey = toSlug(REPRO_WITHOUT_NAME); // 열람(이름 없음)
  const acceptedKeys = normalizeEntitlementReadingKeys(readKey, [readKey]);

  // 드리프트가 있어도 같은 차트면 매칭(구매자가 PDF·본문을 본다).
  assert.equal(lifetimeReadingKeyMatches(grantKey, acceptedKeys), true);
  // 반대 방향(이름 없이 저장 → 이름 있게 열람)도 대칭.
  const accepted2 = normalizeEntitlementReadingKeys(grantKey, [grantKey]);
  assert.equal(lifetimeReadingKeyMatches(readKey, accepted2), true);
  // 다른 차트(생년월일 다름)는 매칭되면 안 된다(권한 오탐 방지).
  const otherKey = toSlug({ ...REPRO_BASE, year: 1991 });
  assert.equal(lifetimeReadingKeyMatches(otherKey, acceptedKeys), false);
});

// 2026-08-29 — 사용자 제보 "깊은 풀이에서 PDF 메뉴가 사라졌다" 회귀 가드.
//   실측 원인은 **출생지 입력 경로** 하나다: 이용권은 검색/직접입력으로 만들어져
//   `-loccustom-lat…-lon…` 인데, 같은 사주를 프리셋으로 다시 보면 `-locseoul` 이라
//   **prefix 자체가 달라진다.** -key<hash> 만 벗기는 보정으로는 못 잡는다
//   → 사주 정체성(4기둥+성별) 매칭이 필요.
//   (좌표 정밀도는 원인이 아니었다 — toSlug 가 항상 소수 4자리로 반올림한다. 아래 ②는
//    그래도 좌표가 다른 경우까지 정체성이 흡수하는지 확인하는 방어 케이스다.)
test('수정: 출생지 입력 경로가 달라도 같은 팔자면 이용권이 이어진다', () => {
  const stored = '1975-6-11-14-male-loccustom-lat35p1796-lon129p0756-solarlongitude-keyaaaa1';

  // ① 같은 사람이 프리셋(부산)으로 다시 본 경우 — loc 토큰 자체가 다르다.
  const preset = '1975-6-11-14-male-locbusan-solarlongitude-keybbbb2';
  assert.equal(
    lifetimeReadingKeyMatches(stored, normalizeEntitlementReadingKeys(preset, []), null),
    false,
    'prefix 보정만으로는 못 잡는다(수정 전 상태)'
  );
  assert.equal(
    lifetimeReadingKeyMatches(
      stored,
      normalizeEntitlementReadingKeys(preset, []),
      sajuIdentityFromReadingKey(preset)
    ),
    true
  );

  // ② 방어: 좌표 자체가 다른 경우(다른 지점을 골랐다)도 같은 팔자면 이어진다.
  const nearby = '1975-6-11-14-male-loccustom-lat35p1533-lon129p1189-solarlongitude-keycccc3';
  assert.equal(
    lifetimeReadingKeyMatches(
      stored,
      normalizeEntitlementReadingKeys(nearby, []),
      sajuIdentityFromReadingKey(nearby)
    ),
    true
  );
});

test('가드: 다른 사주(생년월일·성별)는 정체성 매칭으로도 거부한다', () => {
  const stored = '1975-6-11-14-male-loccustom-lat35p1796-lon129p0756-solarlongitude-keyaaaa1';

  const otherDate = '1990-5-3-14-male-locbusan-solarlongitude-keydddd4';
  const otherGender = '1975-6-11-14-female-locbusan-solarlongitude-keyeeee5';
  for (const key of [otherDate, otherGender]) {
    assert.equal(
      lifetimeReadingKeyMatches(
        stored,
        normalizeEntitlementReadingKeys(key, []),
        sajuIdentityFromReadingKey(key)
      ),
      false
    );
  }
});
