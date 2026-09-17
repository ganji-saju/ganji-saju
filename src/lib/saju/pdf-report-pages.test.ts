import assert from 'node:assert/strict';
import { chunkPdfYears, paginatePdfNarrative } from './pdf-report-pages';

declare const test: (name: string, fn: () => void) => void;

test('PDF pagination preserves long Korean paid prose without truncation', () => {
  const source = '문장 경계가 긴 사주 풀이를 빠뜨리지 않고 보여줍니다. '.repeat(150);
  const pages = paginatePdfNarrative([{ label: '성향', text: source }]);
  const normalized = (value: string) => value.replace(/\s/g, '');
  assert.equal(normalized(pages.flat().map((section) => section.text).join('')), normalized(source));
  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => page.reduce((sum, section) => sum + section.text.length + 160, 0) <= 1600));
});

test('PDF pagination handles unbroken prose and omits empty pages', () => {
  assert.deepEqual(paginatePdfNarrative([{ label: '빈 내용', text: '   ' }]), []);
  const pages = paginatePdfNarrative([{ label: '풀이', text: '가'.repeat(5000) }]);
  assert.equal(pages.flat().map((section) => section.text).join('').length, 5000);
  assert.ok(pages.every((page) => page.length > 0));
});

test('PDF annual pages contain all 101 years once, with a final single year', () => {
  const years = Array.from({ length: 101 }, (_, age) => 1990 + age);
  const pages = chunkPdfYears(years);
  assert.equal(pages.length, 51);
  assert.deepEqual(pages.flat(), years);
  assert.deepEqual(pages.at(-1), [2090]);
});
