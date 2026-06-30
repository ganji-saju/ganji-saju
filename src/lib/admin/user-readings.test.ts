// src/lib/admin/user-readings.test.ts
// buildReadingLabel 순수함수 단위 테스트.
import assert from 'node:assert/strict';
import { buildReadingLabel } from './user-readings';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const BASE_CREATED = '2026-06-20T03:00:00.000Z'; // UTC → 06-20

test('buildReadingLabel: 이름+시간 있음', () => {
  const label = buildReadingLabel(
    { name: '홍길동', year: 2000, month: 1, day: 15, hour: 19, gender: 'male' },
    BASE_CREATED
  );
  assert.equal(label, '홍길동 · 2000-01-15 戌 · 06-20');
});

test('buildReadingLabel: 이름 없음 + 시간 있음', () => {
  const label = buildReadingLabel(
    { year: 1990, month: 3, day: 5, hour: 0 },
    BASE_CREATED
  );
  // hour 0 → 子시
  assert.equal(label, '1990-03-05 子 · 06-20');
});

test('buildReadingLabel: 이름 있음 + 시간 모름(unknownTime)', () => {
  const label = buildReadingLabel(
    { name: '김순이', year: 1985, month: 12, day: 31, unknownTime: true },
    BASE_CREATED
  );
  assert.equal(label, '김순이 · 1985-12-31 · 06-20');
});

test('buildReadingLabel: 이름 없음 + 시간 없음(hour undefined)', () => {
  const label = buildReadingLabel(
    { year: 2001, month: 7, day: 4 },
    BASE_CREATED
  );
  assert.equal(label, '2001-07-04 · 06-20');
});

test('buildReadingLabel: hour 23 → 子시', () => {
  const label = buildReadingLabel(
    { year: 2000, month: 1, day: 1, hour: 23 },
    BASE_CREATED
  );
  assert.ok(label.includes('子'), `label should include 子 but got: ${label}`);
});

test('buildReadingLabel: 이름 공백만 → 이름 없음 처리', () => {
  const label = buildReadingLabel(
    { name: '   ', year: 2000, month: 6, day: 10, hour: 11 },
    BASE_CREATED
  );
  // trimmed name is empty → no name part
  assert.equal(label, '2000-06-10 午 · 06-20');
});
