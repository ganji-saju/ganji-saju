import assert from 'node:assert/strict';
import { yearToGanji } from './year-ganji';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('yearToGanji computes year-pillar ganji (기준 서기4년=甲子)', () => {
  assert.equal(yearToGanji(2005), '乙酉');
  assert.equal(yearToGanji(1969), '己酉');
  assert.equal(yearToGanji(1957), '丁酉');
  assert.equal(yearToGanji(1981), '辛酉');
  assert.equal(yearToGanji(1993), '癸酉');
  assert.equal(yearToGanji(1900), '庚子');
  assert.equal(yearToGanji(1984), '甲子');
});

test('same-branch different-generation years share ganji (60갑자 동치)', () => {
  assert.equal(yearToGanji(1945), yearToGanji(2005));
  assert.equal(yearToGanji(1945), '乙酉');
  assert.notEqual(yearToGanji(2004).slice(-1), '酉');
});
