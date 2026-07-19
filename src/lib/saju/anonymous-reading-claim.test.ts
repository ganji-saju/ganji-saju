import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { readAnonymousReadingTickets } from './anonymous-reading-claim';

declare const test: (name: string, fn: () => void) => void;

// 익명 reading 은 user_id 가 NULL 이라 DB 에 소유자 증거가 없다. 로그인 시 아무 id 나
// claim 하게 두면 **남의 사주를 가져갈 수 있다**. 그래서 이 브라우저의 httpOnly 쿠키에
// 적힌 id 만 통과시킨다 — 아래는 그 통과 규칙(위조 방어의 1차 관문) 가드다.
function reqWithCookie(value: string | undefined): NextRequest {
  return {
    cookies: { get: () => (value === undefined ? undefined : { value }) },
  } as unknown as NextRequest;
}

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

test('anon-claim: 쿠키가 없으면 claim 대상 0건', () => {
  assert.deepEqual(readAnonymousReadingTickets(reqWithCookie(undefined)), []);
  assert.deepEqual(readAnonymousReadingTickets(reqWithCookie('')), []);
});

test('anon-claim: UUID 형식이 아닌 값은 전부 버린다(주입·위조 방어)', () => {
  const hostile = [
    "' or 1=1--",
    '*',
    'null',
    '../../etc/passwd',
    '1',
    `${A}; drop table readings`,
  ].join(',');
  assert.deepEqual(readAnonymousReadingTickets(reqWithCookie(hostile)), []);
});

test('anon-claim: 유효 UUID 만 골라낸다', () => {
  assert.deepEqual(readAnonymousReadingTickets(reqWithCookie(`${A},쓰레기,${B}`)), [A, B]);
});

test('anon-claim: 쿠키 비대화 방어 — 최대 5건까지만', () => {
  const many = Array.from(
    { length: 12 },
    (_, i) => `1111111${i % 10}-2222-4333-8444-555555555555`
  ).join(',');
  assert.equal(readAnonymousReadingTickets(reqWithCookie(many)).length, 5);
});

test('anon-claim: 공백이 섞여도 정상 파싱', () => {
  assert.deepEqual(readAnonymousReadingTickets(reqWithCookie(` ${A} , ${B} `)), [A, B]);
});
