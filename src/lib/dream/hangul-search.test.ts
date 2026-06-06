import assert from 'node:assert/strict';
import { toChosung, toJamo, isChosungOnly } from './hangul-search';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('toChosung extracts leading consonants', () => {
  assert.equal(toChosung('뱀'), 'ㅂ');
  assert.equal(toChosung('돈가방'), 'ㄷㄱㅂ');
  assert.equal(toChosung('이빨'), 'ㅇㅃ');
  assert.equal(toChosung('a1 가'), 'a1 ㄱ');
});

test('toJamo decomposes syllables into jamo', () => {
  assert.equal(toJamo('가'), 'ㄱㅏ');
  assert.equal(toJamo('뱀'), 'ㅂㅐㅁ');
  assert.equal(toJamo('값'), 'ㄱㅏㅄ');
  assert.equal(toJamo('ab'), 'ab');
});

test('isChosungOnly detects chosung-only strings', () => {
  assert.equal(isChosungOnly('ㅂ'), true);
  assert.equal(isChosungOnly('ㄷㄱ'), true);
  assert.equal(isChosungOnly('뱀'), false);
  assert.equal(isChosungOnly(''), false);
  assert.equal(isChosungOnly('ㅏ'), false);
});
