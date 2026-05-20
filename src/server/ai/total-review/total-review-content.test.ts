import assert from 'node:assert/strict';
import {
  GANGUK_EASY,
  KYEOKGUK_CAREER_FIT,
  padToThree,
} from './total-review-content';

// 2026-05-21 — 총평 신규 도출 컨텐츠 맵 + 강점/약점 패딩 검증. spec §2.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('GANGUK_EASY: 신약을 일상어 label+detail 로, 명리어/한자 미노출', () => {
  const g = GANGUK_EASY['신약'];
  assert.ok(g.label.length > 0);
  assert.ok(!/신약|신강|강약/.test(g.label), `label 에 명리어 노출: ${g.label}`);
  assert.ok(!/[一-鿿]/.test(g.detail), `detail 에 한자 노출: ${g.detail}`);
});

test('GANGUK_EASY: 신강/중화/신약 3종 모두 존재', () => {
  for (const level of ['신강', '중화', '신약'] as const) {
    assert.ok(GANGUK_EASY[level]?.label, `${level} 누락`);
  }
});

test('KYEOKGUK_CAREER_FIT: 식신 → 분석/기획/상담/교육/돌봄/연구 포함', () => {
  for (const job of ['분석', '기획', '상담', '교육', '돌봄', '연구']) {
    assert.ok(
      KYEOKGUK_CAREER_FIT['식신'].includes(job),
      `식신 career_fit 에 ${job} 누락`
    );
  }
});

test('KYEOKGUK_CAREER_FIT: 십성 10종 모두 직군 매핑', () => {
  const tenGods = [
    '비견', '겁재', '식신', '상관', '편재',
    '정재', '편관', '정관', '편인', '정인',
  ] as const;
  for (const tg of tenGods) {
    assert.ok(KYEOKGUK_CAREER_FIT[tg]?.length > 0, `${tg} 직군 누락`);
  }
});

test('padToThree: 2개면 filler 로 채워 3개', () => {
  assert.deepEqual(padToThree(['a', 'b'], ['c', 'd']), ['a', 'b', 'c']);
});

test('padToThree: 3개 초과면 앞에서 3개만', () => {
  assert.deepEqual(padToThree(['a', 'b', 'c', 'd'], ['e']), ['a', 'b', 'c']);
});

test('padToThree: 중복은 제거하고 채운다', () => {
  assert.deepEqual(padToThree(['a'], ['a', 'b']), ['a', 'b']);
});

test('padToThree: 공백/빈 항목은 무시', () => {
  assert.deepEqual(padToThree(['a', '  ', ''], ['b', 'c']), ['a', 'b', 'c']);
});
