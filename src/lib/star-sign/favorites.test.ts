// 2026-05-16 PR #138 — 즐겨찾기 유틸 검증.
import assert from 'node:assert/strict';
import { isValidStarSignSlug } from './favorites';

declare const test: (name: string, fn: () => void) => void;

test('isValidStarSignSlug - 12 별자리 모두 통과', () => {
  const valid = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ];
  for (const slug of valid) {
    assert.ok(isValidStarSignSlug(slug), `${slug} should be valid`);
  }
});

test('isValidStarSignSlug - 잘못된 값 거부', () => {
  assert.equal(isValidStarSignSlug(''), false);
  assert.equal(isValidStarSignSlug('rat'), false); // 띠 슬러그
  assert.equal(isValidStarSignSlug('ARIES'), false); // 대문자
  assert.equal(isValidStarSignSlug(null), false);
  assert.equal(isValidStarSignSlug(undefined), false);
  assert.equal(isValidStarSignSlug(123), false);
  assert.equal(isValidStarSignSlug({}), false);
  assert.equal(isValidStarSignSlug('aries '), false); // 공백
});
