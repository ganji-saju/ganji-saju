import assert from 'node:assert/strict';
import type { Ohaeng } from '../types';
import {
  SCORE_LEVEL_TOKENS,
  OHAENG_TOKENS,
  BREAKDOWN_FACTOR_META,
  BREAKDOWN_ORDER,
  getScoreLevelToken,
  getScoreLevelTokenByTotal,
  getOhaengToken,
  getBreakdownFactorMeta,
  getBarFillPercent,
} from '../visual-tokens';
import { getLabel } from '../labels';
import { computeOhaengChart } from '../ohaeng';
import type { SajuData } from '../types';

// 2026-05-21 — 점수 시각 토큰 단일 소스(Phase 2). 등급·오행·내역지표 색상/라벨/max/fill%.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const HEX = /^#[0-9a-f]{6}$/;

// ── 등급(5단계) 토큰 ──
test('SCORE_LEVEL_TOKENS: 5등급 모두 정의 + hex + tailwind 클래스 6종', () => {
  const levels = ['excellent', 'good', 'neutral', 'mindful', 'potential'] as const;
  for (const level of levels) {
    const t = SCORE_LEVEL_TOKENS[level];
    assert.ok(t, `${level} 토큰 존재`);
    assert.match(t.hex, HEX, `${level} hex`);
    for (const key of ['bg', 'bgSoft', 'text', 'textOnDark', 'ring', 'gradient'] as const) {
      assert.equal(typeof t[key], 'string');
      assert.ok(t[key].length > 0, `${level}.${key} 비어있지 않음`);
    }
  }
});

test('getScoreLevelToken: level → 동일 토큰 반환', () => {
  assert.deepEqual(getScoreLevelToken('good'), SCORE_LEVEL_TOKENS.good);
});

test('getScoreLevelTokenByTotal: labels.ts 임계값과 동일 매핑', () => {
  // labels.ts LABEL_TABLE: 90+ excellent / 75+ good / 60+ neutral / 45+ mindful / 0+ potential
  assert.equal(getScoreLevelTokenByTotal(95), SCORE_LEVEL_TOKENS.excellent);
  assert.equal(getScoreLevelTokenByTotal(90), SCORE_LEVEL_TOKENS.excellent);
  assert.equal(getScoreLevelTokenByTotal(89), SCORE_LEVEL_TOKENS.good);
  assert.equal(getScoreLevelTokenByTotal(75), SCORE_LEVEL_TOKENS.good);
  assert.equal(getScoreLevelTokenByTotal(60), SCORE_LEVEL_TOKENS.neutral);
  assert.equal(getScoreLevelTokenByTotal(45), SCORE_LEVEL_TOKENS.mindful);
  assert.equal(getScoreLevelTokenByTotal(0), SCORE_LEVEL_TOKENS.potential);
  assert.equal(getScoreLevelTokenByTotal(44), SCORE_LEVEL_TOKENS.potential);
});

test('getScoreLevelTokenByTotal: getLabel 과 같은 등급의 색상 일치 (단일 소스)', () => {
  // labels.ts 의 라벨 color 와 visual-tokens 토큰이 같은 등급에서 tailwind 클래스가 일치해야 함
  for (const total of [10, 50, 65, 80, 95]) {
    const labelColor = getLabel(total).color;
    const token = getScoreLevelTokenByTotal(total);
    assert.equal(token.bg, labelColor.bg, `total=${total} bg 일치`);
    assert.equal(token.gradient, labelColor.gradient, `total=${total} gradient 일치`);
  }
});

// ── 오행(5) 토큰 ──
test('OHAENG_TOKENS: 5오행 모두 hex + "X 기운" 라벨', () => {
  const elements: Ohaeng[] = ['목', '화', '토', '금', '수'];
  for (const el of elements) {
    const t = OHAENG_TOKENS[el];
    assert.ok(t, `${el} 토큰 존재`);
    assert.match(t.hex, HEX, `${el} hex`);
    assert.equal(t.label, `${el} 기운`, `${el} 라벨 = "X 기운" (naming-policy §2)`);
  }
});

test('getOhaengToken: computeOhaengChart 색상과 단일 소스 (동일 hex)', () => {
  const saju: SajuData = {
    yeonju: { gan: '갑', ji: '자' },
    wolju: { gan: '병', ji: '인' },
    ilju: { gan: '무', ji: '진' },
    siju: { gan: '경', ji: '오' },
    cheongan: ['갑', '병', '무', '경'],
    jiji: ['자', '인', '진', '오'],
    allEightChars: ['갑', '자', '병', '인', '무', '진', '경', '오'],
    ilgan: '무',
    kyeokguk: '식신격',
    yongsin: '목',
    ganguk: '중화',
    gilsinList: [],
    hyungsalList: [],
    hasGongmang: false,
  };
  const chart = computeOhaengChart(saju);
  for (const el of ['목', '화', '토', '금', '수'] as Ohaeng[]) {
    assert.equal(getOhaengToken(el).hex, chart.colors[el], `${el} hex 단일 소스`);
  }
});

// ── 내역지표(F1~F5) 메타 ──
test('BREAKDOWN_ORDER: F1~F5 순서 고정', () => {
  assert.deepEqual(BREAKDOWN_ORDER, ['F1', 'F2', 'F3', 'F4', 'F5']);
});

test('BREAKDOWN_FACTOR_META: F1~F5 라벨/max/hex + 한자 0', () => {
  for (const key of BREAKDOWN_ORDER) {
    const m = BREAKDOWN_FACTOR_META[key];
    assert.ok(m, `${key} 메타 존재`);
    assert.equal(m.key, key);
    assert.ok(m.label.length > 0, `${key} 라벨`);
    assert.equal(m.max, 20, `${key} max=20`);
    assert.match(m.hex, HEX, `${key} hex`);
    // naming-policy: 한자 미노출
    assert.ok(!/[一-鿿]/.test(m.label), `${key} 라벨 한자 0`);
    assert.ok(!/[一-鿿]/.test(m.description), `${key} 설명 한자 0`);
  }
});

test('getBreakdownFactorMeta: key → 동일 메타', () => {
  assert.deepEqual(getBreakdownFactorMeta('F3'), BREAKDOWN_FACTOR_META.F3);
});

// ── fill % helper ──
test('getBarFillPercent: value/max 비율 0~100 clamp + 반올림', () => {
  assert.equal(getBarFillPercent(10, 20), 50);
  assert.equal(getBarFillPercent(0, 20), 0);
  assert.equal(getBarFillPercent(20, 20), 100);
  assert.equal(getBarFillPercent(25, 20), 100, '초과 → 100 clamp');
  assert.equal(getBarFillPercent(-5, 20), 0, '음수 → 0 clamp');
  assert.equal(getBarFillPercent(3, 20), 15);
  assert.equal(getBarFillPercent(1, 3), 33, '반올림');
});

test('getBarFillPercent: max<=0 이면 0 (0 나눗셈 방지)', () => {
  assert.equal(getBarFillPercent(5, 0), 0);
});
