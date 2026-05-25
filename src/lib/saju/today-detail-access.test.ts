import assert from 'node:assert/strict';
import { todayDetailEntitlementScopeKeys } from './today-detail-access';

declare const test: (name: string, fn: () => void) => void;

// 2026-05-24 — 결제 무한반복 근본원인 fix.
//   today-detail 권한이 불안정한 reading id(slug)에 묶여, 사주 재생성·경로 교차 시
//   slug 가 바뀌면 결제해도 못 찾는 버그. 조회 scope 를 안정적인 readingKey 우선 +
//   legacy readingId 병행으로 통일한다(grant 도 product-scope 에서 readingKey 로 통일).
test('today-detail 조회 scope: readingKey(안정) 우선 + legacy readingId 병행', () => {
  // 사주를 다시 만들어 slug(readingId)가 바뀌어도, 같은 사람이면 readingKey 가 같아
  //   readingKey scope 로 인식. 과거 readingId 로 결제한 분은 legacy slug scope 로 인식.
  assert.deepEqual(
    todayDetailEntitlementScopeKeys({ slug: 'reading-id-B', readingKey: 'rk-stable' }),
    ['today:rk-stable', 'today:reading-id-B']
  );
});

test('today-detail 조회 scope: readingKey 없으면 slug 만 (게스트·세션 식별자)', () => {
  assert.deepEqual(
    todayDetailEntitlementScopeKeys({ slug: 'src-session-1', readingKey: null }),
    ['today:src-session-1']
  );
});

test('today-detail 조회 scope: slug==readingKey 면 중복 제거', () => {
  assert.deepEqual(
    todayDetailEntitlementScopeKeys({ slug: 'rk', readingKey: 'rk' }),
    ['today:rk']
  );
});

test('today-detail 조회 scope: 식별자가 전혀 없으면 빈 배열', () => {
  assert.deepEqual(todayDetailEntitlementScopeKeys({ slug: null, readingKey: null }), []);
});
