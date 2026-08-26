// 2026-08-26 회귀 가드 — GA4 귀속 식별자 파싱.
//   틀린 client_id 로 보내면 남의 세션에 매출이 붙고, session_id 가 빠지면 GA4 가
//   '새 세션 / (direct)' 로 처리해 **채널별 매출이 전부 Direct 로 몰린다**.
import assert from 'node:assert/strict';
import {
  gaSessionCookieName,
  parseCookieHeader,
  parseGaClientId,
  parseGaSessionId,
  readGaIdentifiers,
} from './ga-identifiers';

declare const test: (name: string, fn: () => void) => void;

test('client_id: _ga 쿠키에서 뒤 두 조각만 취한다', () => {
  assert.equal(parseGaClientId('GA1.1.1234567890.1699999999'), '1234567890.1699999999');
  assert.equal(parseGaClientId('GA1.2.987.654'), '987.654');
});

test('client_id: 형식이 다르면 추측하지 않고 null', () => {
  for (const bad of ['', null, undefined, 'GA1.1.abc.def', '1234567890.1699999999', 'GA1.1.123']) {
    assert.equal(parseGaClientId(bad), null, String(bad));
  }
});

test('session_id: GS 쿠키의 첫 숫자 조각(세션 시작 타임스탬프)', () => {
  assert.equal(parseGaSessionId('GS1.1.1756180000.3.1.1756180200.60.0.0'), '1756180000');
  assert.equal(parseGaSessionId('GS2.1.s1756180000$o3$g1$t1756180200'), '1756180000');
});

test('session_id: 형식이 다르면 null — 없는 채로 보내는 게 틀린 값보다 낫다', () => {
  for (const bad of ['', null, undefined, 'GA1.1.123.456', 'GS1.1.abc']) {
    assert.equal(parseGaSessionId(bad), null, String(bad));
  }
});

test('세션 쿠키 이름: 측정 ID 에서 파생', () => {
  assert.equal(gaSessionCookieName('G-F6BP90L8E2'), '_ga_F6BP90L8E2');
  assert.equal(gaSessionCookieName('g-abc123'), '_ga_ABC123');
  assert.equal(gaSessionCookieName('UA-12345-1'), null);
  assert.equal(gaSessionCookieName(null), null);
});

test('쿠키 헤더 파싱: 공백·중복·URL 인코딩', () => {
  const m = parseCookieHeader('a=1; b=hello%20world;a=2; empty=');
  assert.equal(m.get('a'), '1', '먼저 나온 값이 이긴다');
  assert.equal(m.get('b'), 'hello world');
  assert.equal(m.get('empty'), '');
  assert.equal(parseCookieHeader(null).size, 0);
});

test('통합: 쿠키 헤더 + 측정 ID → 두 식별자', () => {
  const header = '_ga=GA1.1.1234567890.1699999999; _ga_F6BP90L8E2=GS1.1.1756180000.3.1';
  assert.deepEqual(readGaIdentifiers(header, 'G-F6BP90L8E2'), {
    clientId: '1234567890.1699999999',
    sessionId: '1756180000',
  });
});

test('통합: 측정 ID 가 없으면 session_id 는 못 읽지만 client_id 는 살린다', () => {
  const header = '_ga=GA1.1.1.2; _ga_F6BP90L8E2=GS1.1.1756180000.3.1';
  assert.deepEqual(readGaIdentifiers(header, null), { clientId: '1.2', sessionId: null });
});
