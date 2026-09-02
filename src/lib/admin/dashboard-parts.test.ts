// 2026-09-01 — /admin 카드별 스트리밍 계약 가드.
//
// 왜: 종전엔 무거운 집계 4종을 한 번에 await 해서 **가장 느린 하나가 끝날 때까지**
//   화면이 백지였다. 약속을 그대로 넘겨야 <Suspense> 가 카드별로 기다린다.
//   누군가 다시 await 해서 하나로 합치면 화면은 조용히 예전으로 돌아간다 — 여기서 막는다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAdminDashboardParts } from './dashboard-summary';
import { resolveAdminPeriod } from './metric-periods';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('대시보드 parts: await 없이 약속을 즉시 돌려준다', () => {
  const parts = getAdminDashboardParts(resolveAdminPeriod('month', '2026-03'));
  assert.equal(parts.period.startKey, '2026-03-01');
  assert.equal(parts.windowDays, 31);
  for (const key of ['operations', 'funnel', 'llm', 'analytics', 'pending', 'recentActivity'] as const) {
    assert.ok(
      typeof (parts[key] as Promise<unknown>)?.then === 'function',
      `${key} 는 약속이어야 한다(await 된 값이면 스트리밍이 죽는다)`
    );
  }
});

test('대시보드 parts: 모든 약속이 스스로 실패를 삼킨다(화면이 통째로 죽지 않게)', async () => {
  const parts = getAdminDashboardParts(resolveAdminPeriod('day', undefined));
  const settled = await Promise.allSettled([
    parts.operations,
    parts.funnel,
    parts.llm,
    parts.analytics,
    parts.pending,
    parts.recentActivity,
  ]);
  assert.deepEqual(
    settled.map((r) => r.status),
    Array(6).fill('fulfilled'),
    'reject 되는 약속이 있으면 unhandled rejection 으로 화면이 죽는다'
  );
  const pending = await parts.pending;
  assert.equal(typeof pending.refundRequested, 'number');
  assert.ok(Array.isArray(await parts.recentActivity));
});

test('/admin 화면은 통짜 await(getAdminDashboardSummary) 로 돌아가지 않았다', () => {
  const page = readFileSync('src/app/admin/page.tsx', 'utf8');
  assert.ok(page.includes('getAdminDashboardParts'), 'parts 를 써야 카드별로 기다린다');
  assert.ok(
    !page.includes('getAdminDashboardSummary('),
    '통짜 await 로 되돌리면 첫 픽셀이 다시 마지막 쿼리를 기다린다'
  );
  assert.ok(page.includes('<Suspense'), 'Suspense 경계가 사라지면 스트리밍도 사라진다');
});
