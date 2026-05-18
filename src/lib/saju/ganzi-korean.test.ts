import test from 'node:test';
import assert from 'node:assert/strict';
import { toKoreanGanzi, toKoreanGanziStem, toKoreanGanziBranch } from './ganzi-korean';

test('한자 2글자 ganzi → 한글', () => {
  assert.equal(toKoreanGanzi('甲午'), '갑오');
  assert.equal(toKoreanGanzi('丙申'), '병신');
  assert.equal(toKoreanGanzi('癸卯'), '계묘');
});

test('한글로 이미 들어온 ganzi 는 그대로', () => {
  assert.equal(toKoreanGanzi('갑오'), '갑오');
});

test('비어있거나 매핑 안 되는 글자는 fallback 그대로', () => {
  assert.equal(toKoreanGanzi(''), '');
  assert.equal(toKoreanGanzi('XX'), 'XX');
});

test('stem 만 추출', () => {
  assert.equal(toKoreanGanziStem('丙申'), '병');
  assert.equal(toKoreanGanziStem(''), '');
});

test('branch 만 추출', () => {
  assert.equal(toKoreanGanziBranch('丙申'), '신');
  assert.equal(toKoreanGanziBranch(''), '');
});
