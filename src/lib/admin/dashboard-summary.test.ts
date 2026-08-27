// 대시보드 요약 순수 헬퍼 회귀 가드(action 라벨 + 윈도우 정규화).
import assert from 'node:assert/strict';
import { labelForAdminAction, normalizeDashboardWindow } from './dashboard-summary';

declare const test: (name: string, fn: () => void) => void;

test('대시보드: 알려진 action 은 한글 라벨', () => {
  assert.equal(labelForAdminAction('grant_credit'), '전 지급');
  assert.equal(labelForAdminAction('refund_approve'), '환불 승인');
  assert.equal(labelForAdminAction('view_detail'), '회원 상세 조회');
});

test('대시보드: 미지정 action 은 원문 그대로', () => {
  assert.equal(labelForAdminAction('some_new_action'), 'some_new_action');
});

// 2026-08-26 — 공용 프리셋(일·주·월·분기·6개월·1년)으로 통일. 구 14일은 프리셋에서 빠졌다.
test('대시보드: 윈도우는 공용 프리셋만 허용, 그 외 30(월) 폴백', () => {
  assert.equal(normalizeDashboardWindow('1'), 1);
  assert.equal(normalizeDashboardWindow('7'), 7);
  assert.equal(normalizeDashboardWindow(30), 30);
  assert.equal(normalizeDashboardWindow('90'), 90);
  assert.equal(normalizeDashboardWindow('180'), 180);
  assert.equal(normalizeDashboardWindow('365'), 365);
  assert.equal(normalizeDashboardWindow(14), 30);
  assert.equal(normalizeDashboardWindow('999'), 30);
  assert.equal(normalizeDashboardWindow(undefined), 30);
  assert.equal(normalizeDashboardWindow('abc'), 30);
});
