// 2026-09-03 — 자체 경로별 방문 집계 가드(migration 078).
//
// 왜 이 계측이 생겼나: "어디서 이탈하나"를 GA4 에 물었다가 크게 틀렸다. GA4 는 /guide 를
//   614세션 1위 유입으로 보고했는데 체류 0.46초짜리 봇이었고, 자체 집계로는 첫 진입 0명이었다.
//   GA4 는 봇 필터가 없고 동의 게이트로 실제의 1/45만 잡는다 — 자체 집계로 옮긴 이유다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPagePathStats } from './page-path-stats';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    rpc: async () => ({ error: null, data: null, ...result }),
  } as unknown as Parameters<typeof getPagePathStats>[0];
}

test('경로 집계: 순방문·PV·1인당 조회를 계산한다', async () => {
  const rows = await getPagePathStats(
    fakeClient({ data: [{ path: '/saju/new', visitors: '120', views: '300' }] }),
    '2026-09-01',
    '2026-09-03'
  );
  assert.deepEqual(rows, [
    { path: '/saju/new', visitors: 120, views: 300, viewsPerVisitor: 2.5 },
  ]);
});

test('경로 집계: RPC 미적용(078 전)이면 빈 배열 — 화면만 비고 나머지는 산다', async () => {
  const rows = await getPagePathStats(
    fakeClient({ error: { message: 'function site_visit_page_counts does not exist' } }),
    '2026-09-01',
    '2026-09-03'
  );
  assert.deepEqual(rows, []);
});

test('경로 집계: limit 을 넘겨도 잘라서 준다', async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ path: `/p${i}`, visitors: 1, views: 1 }));
  const rows = await getPagePathStats(fakeClient({ data: many }), '2026-09-01', '2026-09-03', 5);
  assert.equal(rows.length, 5);
});

// ⚠️ 경로에 생년월일·이름이 실리는 서비스라, 저장 전에 sanitize 를 거치는 것이 전제다.
test('경로 기록: /api/visit 은 sanitize 된 경로만 넘긴다', () => {
  const route = readFileSync('src/app/api/visit/route.ts', 'utf8');
  assert.ok(route.includes('normalizeVisitPath'), 'sanitize 헬퍼가 사라졌다');
  assert.ok(
    /track_site_visit_page'[\s\S]{0,200}p_path: path/.test(route),
    '경로 기록에 원본이 아니라 정제된 path 변수를 넘겨야 한다'
  );
});

test('경로 기록: 계측 실패가 순방문 집계를 막지 않는다(await 금지)', () => {
  const route = readFileSync('src/app/api/visit/route.ts', 'utf8');
  const block = route.slice(route.indexOf("track_site_visit_page'") - 200);
  assert.ok(
    !/await service\s*\n?\s*\.rpc\('track_site_visit_page'/.test(block),
    '경로 기록을 await 하면 그 실패·지연이 방문 핑 전체를 물고 늘어진다'
  );
});
