// 어드민 내비 config 회귀 가드 — 역할 필터 + 활성 경로 선택.
import assert from 'node:assert/strict';
import {
  ADMIN_NAV_GROUPS,
  getVisibleNavGroups,
  getActiveNavHref,
  allNavHrefs,
  flattenNavItems,
  navItemContainsHref,
} from './nav';

declare const test: (name: string, fn: () => void) => void;

test('내비: admin 은 super_admin 전용(정책) 항목을 못 본다', () => {
  const groups = getVisibleNavGroups('admin');
  const hrefs = flattenNavItems(groups).map((i) => i.href);
  assert.ok(!hrefs.includes('/admin/policies'), 'admin 에게 정책 노출되면 안 됨');
  assert.ok(hrefs.includes('/admin/operations'), '운영 지표는 admin 에게 보여야 함');
});

test('내비: super_admin 은 정책 포함 모든 항목을 본다', () => {
  const groups = getVisibleNavGroups('super_admin');
  const hrefs = flattenNavItems(groups).map((i) => i.href);
  assert.ok(hrefs.includes('/admin/policies'), 'super_admin 에게 정책 노출돼야 함');
  // super_admin 항목 수 >= admin 항목 수.
  const adminHrefs = flattenNavItems(getVisibleNavGroups('admin')).map((i) => i.href);
  assert.ok(hrefs.length >= adminHrefs.length);
});

test('내비: 빈 그룹은 제외된다', () => {
  for (const group of getVisibleNavGroups('admin')) {
    assert.ok(group.items.length > 0, `빈 그룹 노출됨: ${group.title}`);
  }
});

test('내비: 대시보드(/admin)는 정확히 일치할 때만 활성', () => {
  assert.equal(getActiveNavHref('/admin'), '/admin');
  // 하위 경로에서는 /admin 이 아니라 더 구체적인 항목이 활성.
  assert.notEqual(getActiveNavHref('/admin/operations'), '/admin');
});

test('내비: 가장 구체적인 href 가 활성(세그먼트 vs 사용자)', () => {
  assert.equal(getActiveNavHref('/admin/users/segments'), '/admin/users/segments');
  assert.equal(getActiveNavHref('/admin/users'), '/admin/users');
  // 사용자 상세도 사용자 목록 항목으로 활성(하위 경로).
  assert.equal(getActiveNavHref('/admin/users/abc-123'), '/admin/users');
});

test('내비: 매칭 없으면 null', () => {
  assert.equal(getActiveNavHref('/admin/unknown-section'), null);
});

test('내비: allNavHrefs 는 중복 없는 경로 목록', () => {
  const hrefs = allNavHrefs();
  assert.equal(hrefs.length, new Set(hrefs).size, 'href 중복 존재');
  assert.ok(hrefs.length >= 10);
});

test('내비: 모든 항목 href 는 /admin 으로 시작', () => {
  for (const item of flattenNavItems(ADMIN_NAV_GROUPS)) {
    assert.ok(item.href.startsWith('/admin'), `잘못된 href: ${item.href}`);
  }
});

// 🔴 회귀 가드(2026-08-27) — 2단 구조에서 **부모 행은 링크가 아니다**.
//   부모를 잎으로 섞으면 대시보드 '바로가기'가 href=undefined 인 카드를 그리고,
//   활성 경로 계산도 빈 문자열과 겨루게 된다.
test('내비: 부모 행은 평탄화에 섞이지 않는다', () => {
  const leaves = flattenNavItems(ADMIN_NAV_GROUPS);
  assert.ok(leaves.every((i) => typeof i.href === 'string' && i.href.length > 0));
  assert.ok(!leaves.some((i) => i.label === '지표'), '부모 행이 잎으로 새어나옴');
  assert.ok(leaves.some((i) => i.href === '/admin/payment-funnel'), '자식이 누락됨');
});

// 🔴 회귀 가드 — super_admin 전용 자식만 남은 부모는 admin 에게 통째로 사라져야 한다.
//   빈 부모가 남으면 아무 데도 못 가는 행이 메뉴에 뜬다.
test('내비: 자식이 전부 걸러진 부모 행은 함께 사라진다', () => {
  for (const group of getVisibleNavGroups('admin')) {
    for (const item of group.items) {
      if (item.children) assert.ok(item.children.length > 0, `빈 부모 노출됨: ${item.label}`);
    }
  }
});

test('내비: 부모는 자식이 열려 있으면 펼쳐진다', () => {
  const metrics = ADMIN_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.label === '지표')!;
  assert.equal(navItemContainsHref(metrics, '/admin/payment-funnel'), true);
  assert.equal(navItemContainsHref(metrics, '/admin/reviews'), false);
  assert.equal(navItemContainsHref(metrics, null), false);
});
