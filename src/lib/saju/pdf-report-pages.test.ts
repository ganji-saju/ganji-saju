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
  const years = Array.from({ length: 101 }, (_, age) => ({ year: 1990 + age, overview: '', learningCareer: '', relationships: '', resources: '', wellbeing: '', action: '' }));
  const pages = chunkPdfYears(years);
  assert.equal(pages.length, 51);
  assert.deepEqual(pages.flat(), years);
  assert.deepEqual(pages.at(-1), [years[100]]);
});

test('PDF annual pagination isolates long entries while preserving every field and normal two-year pages', () => {
  const short = { overview: '개요입니다.', learningCareer: '배움입니다.', relationships: '관계입니다.', resources: '생활입니다.', wellbeing: '리듬입니다.', action: '실천입니다.' };
  const long = Object.fromEntries(Object.keys(short).map((key) => [key, '긴 사주 풀이를 빠뜨리지 않고 그대로 보존합니다. '.repeat(12)])) as typeof short;
  const years = [short, short, long, long, short, short].map((text, age) => ({ ...text, age }));
  const before = JSON.stringify(years);
  const pages = chunkPdfYears(years);
  assert.deepEqual(pages.map((page) => page.map((year) => year.age)), [[0, 1], [2], [3], [4, 5]]);
  assert.deepEqual(pages.flat(), years);
  assert.equal(JSON.stringify(years), before);
});

test('PDF questions in a new chapter start on their own page and retain their chapter after splitting', () => {
  const pages = paginatePdfNarrative([
    { chapter: '돈', label: '버는 방식', text: '재물 풀이입니다.' },
    { chapter: '일', label: '맞는 일', text: '긴 직업 풀이입니다. '.repeat(170) },
  ]);
  assert.equal(pages[0].length, 1);
  assert.ok(pages.slice(1).every((page) => page.every((section) => section.chapter === '일')));
  const shortChapter = paginatePdfNarrative(Array.from({ length: 4 }, (_, i) => ({ chapter: '돈', label: i === 3 ? '종합 해설' : `질문 ${i + 1}`, text: '짧은 답입니다.' })));
  assert.equal(shortChapter.length, 1, 'A short closing explanation must not create an almost empty extra sheet');
});
