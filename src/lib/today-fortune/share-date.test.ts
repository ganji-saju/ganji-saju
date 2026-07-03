import assert from 'node:assert/strict';
import { parseShareDateKey } from './share-date';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('parseShareDateKey — 정상 날짜는 KST 정오 Date', () => {
  const d = parseShareDateKey('2026-07-03');
  assert.ok(d);
  // KST 정오 = UTC 03:00.
  assert.equal(d.toISOString(), '2026-07-03T03:00:00.000Z');
});

test('parseShareDateKey — 형식 불일치는 null', () => {
  assert.equal(parseShareDateKey('2026-7-3'), null);
  assert.equal(parseShareDateKey('20260703'), null);
  assert.equal(parseShareDateKey('2026-07-03T00:00'), null);
  assert.equal(parseShareDateKey(''), null);
  assert.equal(parseShareDateKey(null), null);
  assert.equal(parseShareDateKey(undefined), null);
});

test('parseShareDateKey — 실존하지 않는 날짜(2월 30일 등)는 null', () => {
  assert.equal(parseShareDateKey('2026-02-30'), null);
  assert.equal(parseShareDateKey('2026-13-01'), null);
  assert.equal(parseShareDateKey('2026-00-10'), null);
});

test('parseShareDateKey — 연도 범위 밖은 null', () => {
  assert.equal(parseShareDateKey('1800-01-01'), null);
  assert.equal(parseShareDateKey('2200-01-01'), null);
});

test('parseShareDateKey — 윤년 처리', () => {
  assert.ok(parseShareDateKey('2024-02-29'));
  assert.equal(parseShareDateKey('2026-02-29'), null);
});
