import assert from 'node:assert/strict';
import type { Ohaeng } from '../types';
import {
  OHAENG_RADAR_ORDER,
  computeOhaengRadarPoints,
  getDominantOhaeng,
  getOhaengBalanceLevel,
} from '../ohaeng-chart';

// 2026-05-21 — 오행 레이더(펜타곤) 차트 순수 로직(Phase 4). 좌표/도미넌트/균형레벨.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const counts = (m: Partial<Record<Ohaeng, number>>): Record<Ohaeng, number> => ({
  목: 0, 화: 0, 토: 0, 금: 0, 수: 0, ...m,
});

const OPT = { cx: 100, cy: 100, radius: 80, maxScale: 4 } as const;

test('OHAENG_RADAR_ORDER: 목화토금수 5축 고정', () => {
  assert.deepEqual(OHAENG_RADAR_ORDER, ['목', '화', '토', '금', '수']);
});

test('computeOhaengRadarPoints: 5축 + 각도 -90/-18(top-start, 시계방향)', () => {
  const { axes } = computeOhaengRadarPoints(counts({}), OPT);
  assert.equal(axes.length, 5);
  // 목 = top: cos(-90)=0, sin(-90)=-1 → (100, 20)
  assert.equal(axes[0].element, '목');
  assert.equal(Math.round(axes[0].x), 100);
  assert.equal(Math.round(axes[0].y), 20);
  // 화 (-18°): x=100+80·cos(-18)=176, y=100+80·sin(-18)=75
  assert.equal(axes[1].element, '화');
  assert.equal(Math.round(axes[1].x), 176);
  assert.equal(Math.round(axes[1].y), 75);
});

test('computeOhaengRadarPoints: count=0 → 데이터점 중심', () => {
  const { data } = computeOhaengRadarPoints(counts({ 화: 4 }), OPT);
  assert.equal(Math.round(data[0].x), 100); // 목 count 0
  assert.equal(Math.round(data[0].y), 100);
});

test('computeOhaengRadarPoints: count=maxScale → 축 끝(full radius)', () => {
  const { data, axes } = computeOhaengRadarPoints(counts({ 화: 4 }), OPT);
  assert.equal(Math.round(data[1].x), Math.round(axes[1].x));
  assert.equal(Math.round(data[1].y), Math.round(axes[1].y));
});

test('computeOhaengRadarPoints: count>maxScale → full radius clamp', () => {
  const { data, axes } = computeOhaengRadarPoints(counts({ 목: 8 }), OPT);
  assert.equal(Math.round(data[0].x), Math.round(axes[0].x));
  assert.equal(Math.round(data[0].y), Math.round(axes[0].y));
});

test('computeOhaengRadarPoints: polygonPoints "x,y x,y ..." 5점', () => {
  const { polygonPoints } = computeOhaengRadarPoints(
    counts({ 목: 2, 화: 2, 토: 2, 금: 2, 수: 2 }),
    OPT
  );
  const pts = polygonPoints.trim().split(/\s+/);
  assert.equal(pts.length, 5);
  for (const p of pts) assert.match(p, /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
});

test('computeOhaengRadarPoints: 기본 옵션(maxScale 동적, 0 나눗셈 방지)', () => {
  const { axes, data } = computeOhaengRadarPoints(counts({})); // all 0
  assert.equal(axes.length, 5);
  // 전부 0 → maxScale=1, 데이터 전부 중심(100,100). NaN 없어야 함.
  for (const d of data) {
    assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y));
  }
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
