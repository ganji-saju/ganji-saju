// 2026-05-16 PR #151 (B2) — parseUserSituation 검증.
import assert from 'node:assert/strict';
import { parseUserSituation } from './user-situation';

declare const test: (name: string, fn: () => void) => void;

test('parseUserSituation - null/undefined → null', () => {
  assert.equal(parseUserSituation(null), null);
  assert.equal(parseUserSituation(undefined), null);
});

test('parseUserSituation - 비객체 → null', () => {
  assert.equal(parseUserSituation('hello'), null);
  assert.equal(parseUserSituation(123), null);
  assert.equal(parseUserSituation([]), null);
});

test('parseUserSituation - 유효한 모든 필드', () => {
  const result = parseUserSituation({
    relationshipStatus: 'dating',
    occupation: 'employee',
    currentConcern: 'business',
    concernNote: '이직 고민',
  });
  assert.deepEqual(result, {
    relationshipStatus: 'dating',
    occupation: 'employee',
    currentConcern: 'business',
    concernNote: '이직 고민',
  });
});

test('parseUserSituation - 잘못된 enum 은 떨굼', () => {
  const result = parseUserSituation({
    relationshipStatus: 'INVALID',
    occupation: 'employee',
    currentConcern: 'NOTHING',
  });
  assert.deepEqual(result, { occupation: 'employee' });
});

test('parseUserSituation - 모두 미입력 → null (false-positive 방지)', () => {
  assert.equal(parseUserSituation({}), null);
  assert.equal(parseUserSituation({ relationshipStatus: 'WRONG' }), null);
});

test('parseUserSituation - concernNote 80자 truncate + trim', () => {
  const long = 'a'.repeat(200);
  const result = parseUserSituation({ concernNote: long });
  assert.equal(result?.concernNote?.length, 80);
});

test('parseUserSituation - 빈 concernNote 무시', () => {
  const result = parseUserSituation({
    occupation: 'employee',
    concernNote: '   ',
  });
  // concernNote 는 trim 후 빈 → 무시. occupation 만 통과.
  assert.deepEqual(result, { occupation: 'employee' });
});

test('parseUserSituation - 잘못된 type 무시', () => {
  const result = parseUserSituation({
    relationshipStatus: 123,
    occupation: { x: 1 },
    currentConcern: null,
  });
  assert.equal(result, null);
});
