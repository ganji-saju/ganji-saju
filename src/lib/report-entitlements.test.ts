import assert from 'node:assert/strict';
import test from 'node:test';
import type { BirthInput } from '@/lib/saju/types';
import { toSlug } from '@/lib/saju/pillars';
import { buildLifetimeReportScopeKey } from '@/lib/payments/product-scope';
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
