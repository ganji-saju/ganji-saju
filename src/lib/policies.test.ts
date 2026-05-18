// Phase 3-B (2026-05-18): 정책 버저닝 유틸 검증.
//
// DB 의존 함수 (getCurrentPolicyVersion / createPolicyVersion / recordUserConsent) 는
// Supabase service client 필요 → 본 테스트에서는 pure 함수 (computeContentHash /
// hashIp / POLICY_KINDS / POLICY_LABELS / POLICY_URLS) 만 검증.
// DB 통합 테스트는 별도 *.spec.ts (vitest + Supabase fixture) 에서.

import assert from 'node:assert/strict';
import {
  POLICY_KINDS,
  POLICY_LABELS,
  POLICY_URLS,
  computeContentHash,
  hashIp,
  type PolicyKind,
} from './policies';

declare const test: (name: string, fn: () => void) => void;

test('POLICY_KINDS — 9 종류 모두 포함 (terms / privacy / refund / digital-content / subscription / coin / appointment / ai-disclaimer / commerce-disclosure)', () => {
  assert.equal(POLICY_KINDS.length, 9);
  for (const k of [
    'terms',
    'privacy',
    'refund',
    'digital-content',
    'subscription',
    'coin',
    'appointment',
    'ai-disclaimer',
    'commerce-disclosure',
  ] as PolicyKind[]) {
    assert.ok(POLICY_KINDS.includes(k), `${k} 누락`);
  }
});

test('POLICY_LABELS / POLICY_URLS — 9 정책 모두 라벨 + URL 정의', () => {
  for (const kind of POLICY_KINDS) {
    assert.ok(POLICY_LABELS[kind] && POLICY_LABELS[kind].length > 0, `${kind} 라벨 누락`);
    assert.ok(POLICY_URLS[kind] && POLICY_URLS[kind].startsWith('/'), `${kind} URL 누락`);
  }
});

test('POLICY_URLS — 모두 고유 (중복 URL 없음)', () => {
  const urls = Object.values(POLICY_URLS);
  const unique = new Set(urls);
  assert.equal(unique.size, urls.length, `중복 URL: ${urls.join(', ')}`);
});

test('computeContentHash — 같은 입력 → 같은 hash (SHA-256 64자 hex)', () => {
  const hash1 = computeContentHash('이용약관 본문');
  const hash2 = computeContentHash('이용약관 본문');
  assert.equal(hash1, hash2);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test('computeContentHash — 다른 입력 → 다른 hash', () => {
  const a = computeContentHash('약관 v1');
  const b = computeContentHash('약관 v2');
  assert.notEqual(a, b);
});

test('computeContentHash — 공백 1개 차이도 다른 hash (무결성 보장)', () => {
  const a = computeContentHash('약관');
  const b = computeContentHash('약관 ');
  assert.notEqual(a, b);
});

test('computeContentHash — 빈 문자열 (운영자가 본문 비울 때) 도 정상 hash', () => {
  const hash = computeContentHash('');
  assert.match(hash, /^[0-9a-f]{64}$/);
  // SHA-256 of empty string is deterministic
  assert.equal(
    hash,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
});

test('hashIp — null/undefined/빈문자열 → null', () => {
  assert.equal(hashIp(null), null);
  assert.equal(hashIp(undefined), null);
  assert.equal(hashIp(''), null);
});

test('hashIp — 실제 IP → SHA-256 64자 hex', () => {
  const hash = hashIp('192.168.1.1');
  assert.match(hash ?? '', /^[0-9a-f]{64}$/);
});

test('hashIp — 같은 IP → 같은 hash (동일 사용자 식별 가능, 원문은 복구 불가)', () => {
  assert.equal(hashIp('10.0.0.1'), hashIp('10.0.0.1'));
});

test('hashIp — 다른 IP → 다른 hash', () => {
  assert.notEqual(hashIp('10.0.0.1'), hashIp('10.0.0.2'));
});

test('hashIp — 공백 trim 후 hash (앞뒤 공백 무시)', () => {
  assert.equal(hashIp('  10.0.0.1  '), hashIp('10.0.0.1'));
});
