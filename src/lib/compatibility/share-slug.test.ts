import assert from 'node:assert/strict';
import { buildCompatibilityShareSlug, parseCompatibilityShareSlug } from './share-slug';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const SELF: BirthInput = { year: 1990, month: 3, day: 14, hour: 8, gender: 'female' };
const PARTNER: BirthInput = { year: 1988, month: 11, day: 2, hour: 22, minute: 30, gender: 'male' };

test('share-slug 라운드트립 — 관계·두 사람 생년 복원', () => {
  const slug = buildCompatibilityShareSlug('lover', SELF, PARTNER);
  const parsed = parseCompatibilityShareSlug(slug);
  assert.ok(parsed);
  assert.equal(parsed.relationship, 'lover');
  assert.equal(parsed.self.year, 1990);
  assert.equal(parsed.self.month, 3);
  assert.equal(parsed.self.day, 14);
  assert.equal(parsed.self.hour, 8);
  assert.equal(parsed.self.gender, 'female');
  assert.equal(parsed.partner.year, 1988);
  assert.equal(parsed.partner.hour, 22);
  assert.equal(parsed.partner.minute, 30);
});

test('share-slug 라운드트립 — 시간 미상(unknownTime)', () => {
  const slug = buildCompatibilityShareSlug(
    'lover',
    { year: 1995, month: 7, day: 1, unknownTime: true },
    PARTNER
  );
  const parsed = parseCompatibilityShareSlug(slug);
  assert.ok(parsed);
  assert.equal(parsed.self.hour, undefined);
});

test('share-slug — 잘못된 relationship 은 null', () => {
  const slug = buildCompatibilityShareSlug('lover', SELF, PARTNER).replace('lover', 'hacker');
  assert.equal(parseCompatibilityShareSlug(slug), null);
});

test('share-slug — 조각 수 불일치/변조는 null', () => {
  assert.equal(parseCompatibilityShareSlug('lover--only-one-part'), null);
  assert.equal(parseCompatibilityShareSlug('lover'), null);
  assert.equal(parseCompatibilityShareSlug(''), null);
  const slug = buildCompatibilityShareSlug('lover', SELF, PARTNER);
  assert.equal(parseCompatibilityShareSlug(`${slug}--extra`), null);
});

test('share-slug — 사람 slug 가 생년 형식이 아니면 null', () => {
  const slug = buildCompatibilityShareSlug('lover', SELF, PARTNER);
  const parts = slug.split('--');
  // fromSlug 는 앞 3조각(년-월-일)이 숫자가 아니면 null.
  const tampered = [parts[0], 'a-b-c', parts[2]].join('--');
  assert.equal(parseCompatibilityShareSlug(tampered), null);
});

test('share-slug — 생년 숫자 변조는 그 값으로 재계산됨(해시 미검증, 조작해도 다른 결과일 뿐)', () => {
  // fromSlug 는 key 해시 토큰을 검증하지 않는다 — 공개 재계산 페이지 특성상
  // 변조 = "다른 두 사람의 궁합"이 될 뿐 보안 문제 아님(개인 데이터 접근 없음).
  const slug = buildCompatibilityShareSlug('lover', SELF, PARTNER);
  const parts = slug.split('--');
  const tampered = [parts[0], parts[1].replace('1990', '1991'), parts[2]].join('--');
  const parsed = parseCompatibilityShareSlug(tampered);
  assert.ok(parsed);
  assert.equal(parsed.self.year, 1991);
});
