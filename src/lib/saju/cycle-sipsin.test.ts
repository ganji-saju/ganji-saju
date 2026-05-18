import test from 'node:test';
import assert from 'node:assert/strict';
import { getCycleSipsin } from './cycle-sipsin';

test('cycle 천간이 일간과 같으면 비견', () => {
  // 일간 갑(甲), cycle 천간 갑(甲) → 비견
  assert.equal(getCycleSipsin('甲', '甲午'), '비견');
});

test('cycle 천간 병(丙) 일간 기(己) → 정인 (병화가 기토를 생함)', () => {
  assert.equal(getCycleSipsin('己', '丙申'), '정인');
});

test('cycle ganzi 가 비어있으면 null', () => {
  assert.equal(getCycleSipsin('甲', ''), null);
});

test('cycle ganzi 의 첫 글자가 매핑 안 되는 글자면 null', () => {
  assert.equal(getCycleSipsin('甲', '??'), null);
});
