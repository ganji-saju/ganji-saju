// 대시보드 요약 순수 헬퍼 회귀 가드(action 라벨).
// 2026-09-01 — 윈도우 정규화 테스트 삭제: 롤링 프리셋(metric-ranges)이 달력 기간으로
//   대체되면서 normalizeDashboardWindow 가 죽었다. 기간 경계는 metric-periods.test.ts.
import assert from 'node:assert/strict';
import { labelForAdminAction } from './dashboard-summary';

declare const test: (name: string, fn: () => void) => void;

test('대시보드: 알려진 action 은 한글 라벨', () => {
  assert.equal(labelForAdminAction('grant_credit'), '전 지급');
  assert.equal(labelForAdminAction('refund_approve'), '환불 승인');
  assert.equal(labelForAdminAction('view_detail'), '회원 상세 조회');
});

test('대시보드: 미지정 action 은 원문 그대로', () => {
  assert.equal(labelForAdminAction('some_new_action'), 'some_new_action');
});

test('labelForAdminAction — 할인쿠폰 관리 액션은 원문(coupon_*)이 아니라 한글로(최근 관리 활동)', () => {
  for (const action of [
    'coupon_tier_update',
    'coupon_tier_toggle',
    'coupon_issue',
    'coupon_batch_revoke',
    'coupon_batch_restore',
    'coupon_batch_expiry',
    'coupon_lookup',
    'coupon_release',
    'coupon_export',
  ]) {
    assert.ok(!labelForAdminAction(action).startsWith('coupon_'), action);
  }
});
