import assert from 'node:assert/strict';
import { SEGMENTS } from './segments';
import { parseListParams } from './user-list-query';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('SEGMENTS: 7+종, key 고유', () => {
  assert.ok(SEGMENTS.length >= 7);
  const keys = SEGMENTS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('SEGMENTS: 각 query가 parseListParams로 해석되고 의미 필터를 가짐', () => {
  for (const s of SEGMENTS) {
    const p = parseListParams(new URLSearchParams(s.query));
    const meaningful =
      p.status !== 'all' || p.paid !== 'all' || p.subscription !== 'all' ||
      p.minLtv != null || p.signupWithinDays != null || p.refundable !== 'all' ||
      p.firstReading !== 'all' || p.inactiveDays != null;
    assert.ok(meaningful, `세그먼트 ${s.key} 가 의미있는 필터 없음`);
    assert.ok(s.label && s.description);
  }
});
