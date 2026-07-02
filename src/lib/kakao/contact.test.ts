// normalizeKoreanMobile / maskKoreanMobile 순수 로직 테스트 (node 러너).
import assert from 'node:assert/strict';
import { normalizeKoreanMobile, maskKoreanMobile } from './contact';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('normalizeKoreanMobile — 하이픈 있는 국내번호', () => {
  assert.equal(normalizeKoreanMobile('010-1234-5678'), '01012345678');
});

test('normalizeKoreanMobile — 공백/점 섞인 입력', () => {
  assert.equal(normalizeKoreanMobile('010 1234.5678'), '01012345678');
});

test('normalizeKoreanMobile — +82 국가코드', () => {
  assert.equal(normalizeKoreanMobile('+82 10-1234-5678'), '01012345678');
});

test('normalizeKoreanMobile — 이미 정규화된 값', () => {
  assert.equal(normalizeKoreanMobile('01012345678'), '01012345678');
});

test('normalizeKoreanMobile — 잘못된 길이/접두어는 null', () => {
  assert.equal(normalizeKoreanMobile('0212345678'), null); // 지역번호
  assert.equal(normalizeKoreanMobile('0101234567'), null); // 10자리
  assert.equal(normalizeKoreanMobile('010123456789'), null); // 12자리
  assert.equal(normalizeKoreanMobile(''), null);
  assert.equal(normalizeKoreanMobile(null), null);
  assert.equal(normalizeKoreanMobile('abcd'), null);
});

test('maskKoreanMobile — 뒷 4자리 마스킹', () => {
  assert.equal(maskKoreanMobile('01012345678'), '010-1234-****');
});

test('maskKoreanMobile — 잘못된 값은 빈 문자열', () => {
  assert.equal(maskKoreanMobile(null), '');
  assert.equal(maskKoreanMobile('123'), '');
});
