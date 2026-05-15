// 2026-05-15 — 생년월일 자동 별자리 매칭 검증.
// /lib/profile-personalization.ts 의 deriveStarSignSlug() 가 12 별자리 경계를
// 정확히 다루는지 점검.
import assert from 'node:assert/strict';
import { deriveStarSignSlug } from '@/lib/profile-personalization';

declare const test: (name: string, fn: () => void) => void;

test('deriveStarSignSlug - 12 별자리 중심 날짜', () => {
  assert.equal(deriveStarSignSlug(4, 5), 'aries');
  assert.equal(deriveStarSignSlug(5, 1), 'taurus');
  assert.equal(deriveStarSignSlug(6, 1), 'gemini');
  assert.equal(deriveStarSignSlug(7, 1), 'cancer');
  assert.equal(deriveStarSignSlug(8, 1), 'leo');
  assert.equal(deriveStarSignSlug(9, 1), 'virgo');
  assert.equal(deriveStarSignSlug(10, 1), 'libra');
  assert.equal(deriveStarSignSlug(11, 1), 'scorpio');
  assert.equal(deriveStarSignSlug(12, 1), 'sagittarius');
  assert.equal(deriveStarSignSlug(1, 1), 'capricorn');
  assert.equal(deriveStarSignSlug(2, 1), 'aquarius');
  assert.equal(deriveStarSignSlug(3, 1), 'pisces');
});

test('deriveStarSignSlug - 별자리 경계 (시작일)', () => {
  // aries: 3.21 - 4.19
  assert.equal(deriveStarSignSlug(3, 21), 'aries');
  // aries 끝
  assert.equal(deriveStarSignSlug(4, 19), 'aries');
  // taurus 시작
  assert.equal(deriveStarSignSlug(4, 20), 'taurus');
  // taurus 끝
  assert.equal(deriveStarSignSlug(5, 20), 'taurus');
  // gemini 시작
  assert.equal(deriveStarSignSlug(5, 21), 'gemini');
});

test('deriveStarSignSlug - 연말연시 capricorn 경계', () => {
  // capricorn: 12.25 - 1.19
  assert.equal(deriveStarSignSlug(12, 25), 'capricorn');
  assert.equal(deriveStarSignSlug(12, 31), 'capricorn');
  assert.equal(deriveStarSignSlug(1, 1), 'capricorn');
  assert.equal(deriveStarSignSlug(1, 19), 'capricorn');
  assert.equal(deriveStarSignSlug(1, 20), 'aquarius');
});

test('deriveStarSignSlug - 12.24 → sagittarius 마지막날', () => {
  assert.equal(deriveStarSignSlug(12, 24), 'sagittarius');
});

test('deriveStarSignSlug - 3.20 → pisces 마지막날', () => {
  assert.equal(deriveStarSignSlug(3, 20), 'pisces');
});

test('deriveStarSignSlug - 모든 month/day 조합 → 유효한 12 슬러그 중 하나', () => {
  const validSlugs = new Set([
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ]);
  for (let m = 1; m <= 12; m += 1) {
    for (let d = 1; d <= 28; d += 1) {
      const slug = deriveStarSignSlug(m, d);
      assert.ok(validSlugs.has(slug), `${m}/${d} → ${slug} invalid`);
    }
  }
});
