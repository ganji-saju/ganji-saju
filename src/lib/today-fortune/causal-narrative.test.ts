import assert from 'node:assert/strict';
import { hashSeed, pickVariant, TermInk, rankJijiRelations } from '@/lib/today-fortune/causal-narrative';

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

test('causal: rankJijiRelations 는 오늘 지지의 최강 관계를 고른다(申子辰 삼합 수)', () => {
  // 1982-01-29 남 진시 원국 지지: 酉(년) 丑(월) 子(일) 辰(시), 오늘 일진 지지 申
  const rel = rankJijiRelations('申', ['酉', '丑', '子', '辰']);
  assert.ok(rel, '관계 미탐지');
  assert.equal(rel!.kind, '삼합');
  assert.equal(rel!.element, '수');
  // 申子辰 → 자수·진토와 만남
  assert.deepEqual(rel!.natalBranches.sort(), ['子', '辰'].sort());
});

test('causal: rankJijiRelations 는 관계 없으면 null', () => {
  assert.equal(rankJijiRelations('午', ['申']), null);
});
