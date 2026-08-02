import assert from 'node:assert/strict';
import { hashSeed, pickVariant, TermInk } from '@/lib/today-fortune/causal-narrative';

declare const test: (name: string, fn: () => void) => void;

test('causal: hashSeed 는 결정론이고 pickVariant 는 시드로 안정 선택', () => {
  assert.equal(hashSeed('a'), hashSeed('a'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
  const items = ['x', 'y', 'z'];
  const s = hashSeed('seed-1');
  assert.equal(pickVariant(items, s, 0), pickVariant(items, s, 0)); // 안정
  assert.ok(items.includes(pickVariant(items, s, 1)));
});

test('causal: TermInk 는 첫 등장에만 괄호 설명을 붙인다', () => {
  const ink = new TermInk();
  assert.equal(ink.sipsung('편관'), '편관(밀어붙이는 별)');
  assert.equal(ink.sipsung('편관'), '편관'); // 재등장은 bare
  assert.equal(ink.element('화'), '화 기운(말·밝게 퍼짐)');
  assert.equal(ink.element('화'), '화 기운');
  assert.deepEqual(ink.terms, ['편관', '화 기운']);
});
