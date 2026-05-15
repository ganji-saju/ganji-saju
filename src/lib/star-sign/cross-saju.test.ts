// 2026-05-15 — 별자리 × 사주 크로스 합성 검증.
import assert from 'node:assert/strict';
import { summarizeCrossOverview, synthesizeCross } from './cross-saju';

declare const test: (name: string, fn: () => void) => void;

test('synthesizeCross - aries (fire) + 丙 (화, 양) → identical relation', () => {
  // aries 의 element fire → 매핑된 동양 element 화. 丙 도 화 → identical.
  const result = synthesizeCross('aries', '丙');
  assert.equal(result.relation, 'identical');
  assert.equal(result.relationLabel, '같은 결');
  assert.equal(result.relationTone, 'best');
  assert.equal(result.dayMasterElement, '화');
  assert.equal(result.yinYang, '양');
  assert.equal(result.signElement, 'fire');
  assert.ok(result.combinedKeywords.length >= 5, 'keywords 합집합');
});

test('synthesizeCross - taurus (earth) + 戊 (토, 양) → identical', () => {
  const result = synthesizeCross('taurus', '戊');
  assert.equal(result.relation, 'identical');
});

test('synthesizeCross - aries (fire→화) + 庚 (금) → control (화극금)', () => {
  // 화 → 금 control.
  const result = synthesizeCross('aries', '庚');
  assert.equal(result.relation, 'control');
  assert.equal(result.relationTone, 'caution');
});

test('synthesizeCross - aries (fire→화) + 壬 (수) → controlled (수극화)', () => {
  const result = synthesizeCross('aries', '壬');
  assert.equal(result.relation, 'controlled');
  assert.equal(result.relationTone, 'caution');
});

test('synthesizeCross - aries (fire→화) + 戊 (토) → generate (화생토)', () => {
  const result = synthesizeCross('aries', '戊');
  assert.equal(result.relation, 'generate');
  assert.equal(result.relationTone, 'good');
});

test('synthesizeCross - aries (fire→화) + 甲 (목) → generated (목생화)', () => {
  const result = synthesizeCross('aries', '甲');
  assert.equal(result.relation, 'generated');
});

test('synthesizeCross - quality + yinYang 통합 인사이트', () => {
  // aries = cardinal, 丙 = 양 → cardinal-양 통합.
  const result = synthesizeCross('aries', '丙');
  assert.ok(result.integratedInsight.includes('시작하는'));
  assert.ok(result.integratedInsight.includes('추진'));

  // taurus = fixed, 乙 = 음 → fixed-음 통합.
  const tauResult = synthesizeCross('taurus', '乙');
  assert.ok(tauResult.integratedInsight.includes('고정'));
  assert.ok(tauResult.integratedInsight.includes('정밀'));
});

test('synthesizeCross - 10 stem 모두 동작', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
  for (const stem of stems) {
    const result = synthesizeCross('libra', stem);
    assert.ok(result.combinedKeywords.length >= 5, `${stem} keywords`);
    assert.ok(result.actionSuggestions.length === 3, `${stem} actions`);
    assert.ok(result.synergyLine.length > 0);
  }
});

test('synthesizeCross - 12 sign 모두 동작', () => {
  const signs = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ] as const;
  for (const slug of signs) {
    const result = synthesizeCross(slug, '甲');
    assert.ok(result, `${slug} synth`);
  }
});

test('summarizeCrossOverview - 일간 모를 때 hint', () => {
  const aries = summarizeCrossOverview('aries');
  assert.equal(aries.signElement, 'fire');
  assert.equal(aries.mappedEastElement, '화');
  assert.ok(aries.hint.includes('불'));
  assert.ok(aries.hint.includes('표현'));
});
