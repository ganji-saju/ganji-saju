// 2026-08-26 회귀 가드 — 관리자 지표 기간 프리셋 단일 정본.
import assert from 'node:assert/strict';
import {
  ADMIN_RANGE_OPTIONS,
  ADMIN_RANGE_VALUES,
  ADMIN_RANGE_MAX_DAYS,
  adminRangeLabel,
  normalizeAdminRange,
} from './metric-ranges';

declare const test: (name: string, fn: () => void) => void;

test('기간 프리셋: 일·주·월·분기·6개월·1년 6종 (사용자 지시 순서)', () => {
  assert.deepEqual(
    ADMIN_RANGE_OPTIONS.map((o) => o.value),
    [1, 7, 30, 90, 180, 365]
  );
  assert.deepEqual(
    ADMIN_RANGE_OPTIONS.map((o) => o.label),
    ['일', '주', '월', '분기', '6개월', '1년']
  );
});

test('기간 프리셋: 상한은 최대 프리셋과 일치 — 서버 clamp 가 프리셋을 잘라내면 안 된다', () => {
  assert.equal(ADMIN_RANGE_MAX_DAYS, Math.max(...ADMIN_RANGE_VALUES));
});

test('정규화: 프리셋 값은 통과, 밖의 값은 fallback', () => {
  assert.equal(normalizeAdminRange('1'), 1);
  assert.equal(normalizeAdminRange(365), 365);
  assert.equal(normalizeAdminRange('180'), 180);
  assert.equal(normalizeAdminRange('14'), 30, '구 프리셋 14일은 더 이상 허용하지 않는다');
  assert.equal(normalizeAdminRange('99999'), 30);
  assert.equal(normalizeAdminRange('abc'), 30);
  assert.equal(normalizeAdminRange(undefined), 30);
  assert.equal(normalizeAdminRange(undefined, 7), 7, 'fallback 은 화면별로 다를 수 있다');
});

test('라벨: 달력 단위 오해를 막으려고 실제 일수를 병기', () => {
  assert.equal(adminRangeLabel(30), '월(30일)');
  assert.equal(adminRangeLabel(90), '분기(90일)');
  assert.equal(adminRangeLabel(1), '일(오늘)');
  assert.equal(adminRangeLabel(14), '14일', '프리셋 밖은 그대로 일수 표기');
});
