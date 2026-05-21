import assert from 'node:assert/strict';
import type { SajuData } from '../types';
import {
  calculateF1, calculateF2, calculateF3, calculateF4, calculateF5,
} from '../formulas';
import { get12Unseong, getKyeokguYongsin } from '../helpers';
import { computeSajuScore } from '../index';
import { TEST_CASES_A_BASE } from '../test-cases';

// 2026-05-21 — F1~F5 단위 + 12운성·결정론 검증. phase-1-task.md §10·§14.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function makeSaju(chars: string[]): SajuData {
  return {
    yeonju: { gan: chars[0], ji: chars[1] },
    wolju: { gan: chars[2], ji: chars[3] },
    ilju: { gan: chars[4], ji: chars[5] },
    siju: { gan: chars[6], ji: chars[7] },
    cheongan: [chars[0], chars[2], chars[4], chars[6]],
    jiji: [chars[1], chars[3], chars[5], chars[7]],
    allEightChars: chars,
    ilgan: chars[4],
    kyeokguk: '식신격',
    yongsin: '목',
    ganguk: '중화',
    gilsinList: [],
    hyungsalList: [],
    hasGongmang: false,
  };
}

// ── 12운성 매핑 (§14-3 알려진 값) ──
test('get12Unseong: 알려진 매핑 14개', () => {
  const known: Array<[string, string, string]> = [
    ['갑', '해', '장생'], ['갑', '인', '건록'], ['갑', '묘', '제왕'],
    ['을', '오', '장생'], ['을', '묘', '건록'], ['병', '인', '장생'],
    ['정', '유', '장생'], ['무', '인', '장생'], ['기', '유', '장생'],
    ['경', '사', '장생'], ['신', '자', '장생'], ['임', '신', '장생'],
    ['계', '묘', '장생'], ['계', '미', '묘'], ['계', '자', '건록'],
  ];
  for (const [ilgan, ji, expected] of known) {
    assert.equal(get12Unseong(ilgan, ji), expected, `${ilgan}${ji} → ${expected}`);
  }
});

test('getKyeokguYongsin: 계 식신 = 을, 갑 식신 = 병', () => {
  assert.equal(getKyeokguYongsin('식신격', '계'), '을');
  assert.equal(getKyeokguYongsin('식신격', '갑'), '병');
  assert.equal(getKyeokguYongsin('정관격', '갑'), '신'); // 갑의 정관 = 신
});

// ── F1 ──
test('F1: 갑인일주 = 건록(19)+양인(2) → 20', () => {
  assert.equal(calculateF1({ gan: '갑', ji: '인' }), 20);
});
test('F1: 병자일주 = 태 → 14', () => {
  assert.equal(calculateF1({ gan: '병', ji: '자' }), 14);
});
test('F1: 계미일주 = 묘 → 8', () => {
  assert.equal(calculateF1({ gan: '계', ji: '미' }), 8);
});
test('F1: 갑진일주 = 쇠(12)+백호(-2) → 10', () => {
  assert.equal(calculateF1({ gan: '갑', ji: '진' }), 10);
});
test('F1: 경진일주 = 양(15)+괴강(1) → 16', () => {
  assert.equal(calculateF1({ gan: '경', ji: '진' }), 16);
});
test('F1: 어떤 입력이든 0~20', () => {
  const s = calculateF1({ gan: '계', ji: '오' });
  assert.ok(s >= 0 && s <= 20);
});

// ── F4 ──
test('F4: 5오행 균형 분포 → 13~16', () => {
  const s = calculateF4(makeSaju(['갑', '경', '병', '임', '무', '인', '신', '자']));
  assert.ok(s >= 13 && s <= 16, `F4=${s}`);
});
test('F4: 한 오행 8개 과다 → 1점 이하', () => {
  const s = calculateF4(makeSaju(['갑', '갑', '을', '을', '인', '인', '묘', '묘']));
  assert.ok(s <= 1, `F4=${s}`);
});
test('F4: 3개 오행만 → 3~7', () => {
  const s = calculateF4(makeSaju(['갑', '갑', '병', '병', '경', '경', '인', '인']));
  assert.ok(s >= 3 && s <= 7, `F4=${s}`);
});

// ── F2/F3/F5 범위 ──
test('F2/F3/F5: 모든 A 케이스에서 범위 보장', () => {
  for (const tc of TEST_CASES_A_BASE) {
    const f2 = calculateF2(tc.saju);
    const f3 = calculateF3(tc.saju);
    const f5 = calculateF5(tc.saju);
    assert.ok(f2 >= 0 && f2 <= 20, `${tc.id} F2=${f2}`);
    assert.ok(f3 >= 0 && f3 <= 20, `${tc.id} F3=${f3}`);
    assert.ok(f5 >= 5 && f5 <= 20, `${tc.id} F5=${f5}`);
  }
});

// ── 결정론 (§14-5) ──
test('동일 사주는 항상 같은 점수 (결정론, 100회)', () => {
  const saju = TEST_CASES_A_BASE[0].saju;
  const scores = Array.from({ length: 100 }, () => computeSajuScore(saju).total);
  assert.equal(new Set(scores).size, 1);
});

test('total 은 항상 0~100', () => {
  for (const tc of [...TEST_CASES_A_BASE]) {
    const total = computeSajuScore(tc.saju).total;
    assert.ok(total >= 0 && total <= 100, `${tc.id} total=${total}`);
  }
});
