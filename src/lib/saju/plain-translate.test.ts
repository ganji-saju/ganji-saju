import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toPlainKorean,
  strengthToPlain,
  luckToPlain,
  isMyeongriTerm,
} from './plain-translate';

// 2026-05-20 V2-5 PR Y — plain-translate helper 단위 검증.

test('toPlainKorean — 격국 inline 형식 (기본)', () => {
  const result = toPlainKorean('정인격');
  assert.match(result, /^정인격\(/, '"정인격(...)" 형태');
  assert.match(result, /돌봄·후원|배움/, 'plainCue 포함');
});

test('toPlainKorean — 격국 replace 형식 (plainCue 만)', () => {
  const result = toPlainKorean('정인격', { format: 'replace' });
  assert.ok(!result.startsWith('정인격'), 'term 미포함');
  assert.match(result, /돌봄·후원|배움/, 'plainCue 만');
});

test('toPlainKorean — 십성 (정인/식신 등)', () => {
  const inline = toPlainKorean('식신');
  assert.match(inline, /^식신\(/);
  const replace = toPlainKorean('식신', { format: 'replace' });
  assert.ok(!replace.startsWith('식신'));
});

test('toPlainKorean — 강약 (신강/신약/중화)', () => {
  assert.equal(toPlainKorean('신약', { format: 'plain-only' }), '에너지가 차분한 편');
  assert.equal(toPlainKorean('신강', { format: 'plain-only' }), '에너지가 강한 편');
  assert.equal(toPlainKorean('중화', { format: 'plain-only' }), '에너지가 균형 잡힌 편');
  assert.match(toPlainKorean('신약'), /^신약\(에너지가 차분한 편\)$/);
});

test('toPlainKorean — 운 (대운/세운/월운/일진)', () => {
  assert.equal(toPlainKorean('대운', { format: 'plain-only' }), '10년 큰 흐름');
  assert.equal(toPlainKorean('세운', { format: 'plain-only' }), '올해 흐름');
  assert.equal(toPlainKorean('월운', { format: 'plain-only' }), '이번 달 흐름');
  assert.equal(toPlainKorean('일진', { format: 'plain-only' }), '오늘 흐름');
});

test('toPlainKorean — 사주 구조 (일주/월주/연주/시주)', () => {
  assert.equal(toPlainKorean('일주', { format: 'plain-only' }), '본인의 본질');
  assert.equal(toPlainKorean('월주', { format: 'plain-only' }), '환경과 사회성');
});

test('toPlainKorean — 미등록 term 은 fallback 반환', () => {
  assert.equal(toPlainKorean('알수없는술어'), '알수없는술어');
  assert.equal(
    toPlainKorean('알수없는술어', { fallback: '기본값' }),
    '기본값'
  );
});

test('toPlainKorean — 신살 (양인살/도화살 등)', () => {
  const inline = toPlainKorean('도화살');
  assert.match(inline, /^도화살\(/);
  const replace = toPlainKorean('도화살', { format: 'replace' });
  assert.ok(!replace.startsWith('도화살'));
});

test('strengthToPlain — 강약 단독 변환', () => {
  assert.equal(strengthToPlain('신약'), '에너지가 차분한 편');
  assert.equal(strengthToPlain('신강'), '에너지가 강한 편');
  assert.equal(strengthToPlain('중화'), '에너지가 균형 잡힌 편');
  assert.equal(strengthToPlain(null), '');
  assert.equal(strengthToPlain(undefined), '');
  assert.equal(strengthToPlain('미등록'), '');
});

test('luckToPlain — 운 단독 변환', () => {
  assert.equal(luckToPlain('대운'), '10년 큰 흐름');
  assert.equal(luckToPlain('세운'), '올해 흐름');
  assert.equal(luckToPlain(null), '');
});

test('isMyeongriTerm — 매핑 존재 여부 검출', () => {
  // MYEONGRI_GLOSSARY
  assert.equal(isMyeongriTerm('정인격'), true);
  assert.equal(isMyeongriTerm('정인'), true);
  assert.equal(isMyeongriTerm('도화살'), true);
  // STRENGTH_PLAIN
  assert.equal(isMyeongriTerm('신약'), true);
  // LUCK_PLAIN
  assert.equal(isMyeongriTerm('대운'), true);
  // PILLAR_PLAIN
  assert.equal(isMyeongriTerm('일주'), true);
  // 미등록
  assert.equal(isMyeongriTerm('알수없음'), false);
  assert.equal(isMyeongriTerm(''), false);
});
