import assert from 'node:assert/strict';
import { hangulizeDeep, toHangulDisplay } from './terminology';

declare const test: (name: string, fn: () => void) => void;

// 2026-09-27 한자 전면 금지 — 출구 한 곳 함수.
test('toHangulDisplay: 한글(한자) 병기를 떼고 남은 간지는 한글로', () => {
  assert.equal(toHangulDisplay('편관격(偏官格)'), '편관격');
  assert.equal(toHangulDisplay('巳 월지의 본기(丙)를 일간(庚) 관점'), '사 월지의 본기를 일간 관점');
  assert.equal(toHangulDisplay('庚辰일주'), '경진일주');
  assert.equal(toHangulDisplay('한자 없음'), '한자 없음');
});

test('hangulizeDeep: 중첩 객체·배열의 모든 문자열을 한글화하고 구조·숫자는 그대로', () => {
  const out = hangulizeDeep({ a: '丁未년', b: ['庚辰', 3], c: { d: '토(土)' }, n: 5 });
  assert.deepEqual(out, { a: '정미년', b: ['경진', 3], c: { d: '토' }, n: 5 });
});
