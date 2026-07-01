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

test('대시보드: 윈도우는 7/14/30 만 허용, 그 외 14 폴백', () => {
  assert.equal(normalizeDashboardWindow('7'), 7);
  assert.equal(normalizeDashboardWindow('30'), 30);
  assert.equal(normalizeDashboardWindow(14), 14);
  assert.equal(normalizeDashboardWindow('999'), 14);
  assert.equal(normalizeDashboardWindow(undefined), 14);
  assert.equal(normalizeDashboardWindow('abc'), 14);
});
