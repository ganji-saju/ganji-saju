import assert from 'node:assert/strict';
import { buildRelatedDreamSlugs } from './related-dreams';

// 2026-07-05 SEO — 관련 꿈 선택 로직(순수·결정론).

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const ALL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

test('buildRelatedDreamSlugs: 큐레이션 우선 배치 후 회전 이웃으로 채움', () => {
  const r = buildRelatedDreamSlugs(ALL, 'a', ['e', 'g'], 4);
  // 큐레이션 e,g 먼저 → 부족분 2개는 a 다음 회전 이웃(b,c). e/g 는 중복 제외.
  assert.deepEqual(r, ['e', 'g', 'b', 'c']);
});

test('buildRelatedDreamSlugs: self 는 항상 제외(큐레이션·회전 양쪽)', () => {
  const r = buildRelatedDreamSlugs(ALL, 'c', ['c', 'd'], 3);
  assert.ok(!r.includes('c'));
  assert.equal(r[0], 'd'); // self(c) 제거, d 유효
});

test('buildRelatedDreamSlugs: 큐레이션 없으면 순수 회전 이웃', () => {
  const r = buildRelatedDreamSlugs(ALL, 'g', [], 3);
  // g(idx6) 다음: h, a, b
  assert.deepEqual(r, ['h', 'a', 'b']);
});

test('buildRelatedDreamSlugs: 유효하지 않은 큐레이션 slug 는 건너뜀', () => {
  const r = buildRelatedDreamSlugs(ALL, 'a', ['zzz', 'e'], 2);
  assert.deepEqual(r, ['e', 'b']); // zzz 무시 → e + 회전 b
});

test('buildRelatedDreamSlugs: count 상한 준수·중복 없음', () => {
  const r = buildRelatedDreamSlugs(ALL, 'a', ['b', 'c'], 5);
  assert.equal(r.length, 5);
  assert.equal(new Set(r).size, 5);
  assert.ok(!r.includes('a'));
});

test('buildRelatedDreamSlugs: 결정론 — 동일 입력 동일 출력', () => {
  const a = buildRelatedDreamSlugs(ALL, 'd', ['f'], 4);
  const b = buildRelatedDreamSlugs(ALL, 'd', ['f'], 4);
  assert.deepEqual(a, b);
});

test('buildRelatedDreamSlugs: 회전 이웃이 전 항목을 커버(강연결 그래프)', () => {
  // 큐레이션 없이 각 페이지가 다음 1개만 링크해도, 링 구조라 모든 노드가 유입 링크를 받는다.
  const incoming = new Set<string>();
  for (const slug of ALL) {
    for (const target of buildRelatedDreamSlugs(ALL, slug, [], 1)) incoming.add(target);
  }
  assert.equal(incoming.size, ALL.length); // 8개 모두 최소 1개 유입 링크
});
