import assert from 'node:assert/strict';
import type { Ohaeng } from '../types';
import {
  OHAENG_RADAR_ORDER,
  getDominantOhaeng,
  getOhaengBalanceLevel,
} from '../ohaeng-chart';

// 2026-05-21 — 오행 도미넌트/균형 순수 로직(Phase 4). OHAENG_RADAR_ORDER · 도미넌트 · 균형레벨.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const counts = (m: Partial<Record<Ohaeng, number>>): Record<Ohaeng, number> => ({
  목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...m,
});

test('OHAENG_RADAR_ORDER: 목화토금수 5축 고정', () => {
  assert.deepEqual(OHAENG_RADAR_ORDER, ['목', '화', '토', '금', '수']);
});

test('getDominantOhaeng: 최다 count 반환', () => {
  assert.equal(getDominantOhaeng(counts({ 목: 1, 화: 3, 토: 1 })), '화');
});

test('getDominantOhaeng: 동점이면 순서(목화토금수) 우선', () => {
  assert.equal(getDominantOhaeng(counts({ 토: 2, 금: 2 })), '토');
});

test('getOhaengBalanceLevel: F4(0~20) → 레벨 + 한자 0 라벨', () => {
  assert.equal(getOhaengBalanceLevel(18).level, 'high');
  assert.equal(getOhaengBalanceLevel(15).level, 'high');
  assert.equal(getOhaengBalanceLevel(14).level, 'mid');
  assert.equal(getOhaengBalanceLevel(9).level, 'mid');
  assert.equal(getOhaengBalanceLevel(8).level, 'low');
  assert.equal(getOhaengBalanceLevel(0).level, 'low');
  for (const s of [18, 13, 6]) {
    assert.ok(!/[一-鿿]/.test(getOhaengBalanceLevel(s).label), `${s} 라벨 한자 0`);
  }
});
