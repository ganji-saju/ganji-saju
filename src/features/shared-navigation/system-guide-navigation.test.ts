import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MEGA_NAV, resolveActiveGroup } from './mega-nav-data';

declare const test: (name: string, fn: () => void) => void;

const navigationDir = path.join(process.cwd(), 'src/features/shared-navigation');

test('MEGA_NAV에 standalone 사용방법 링크가 정확히 한 번 있고 /guide를 활성화한다', () => {
  const guideGroups = MEGA_NAV.filter((group) => group.label === '사용방법');

  assert.equal(guideGroups.length, 1);
  assert.deepEqual(guideGroups[0], {
    label: '사용방법',
    simple: true,
    href: '/guide',
  });
  assert.equal(resolveActiveGroup('/guide'), '사용방법');
});

test('데스크톱 주 메뉴는 MEGA_NAV의 standalone /guide 링크를 렌더한다', () => {
  const source = fs.readFileSync(path.join(navigationDir, 'mega-nav.tsx'), 'utf8');
  const primaryNavigation = source.match(
    /<nav className="mega-nav-list" aria-label="주 메뉴">([\s\S]*?)<\/nav>/,
  )?.[1];

  assert.ok(primaryNavigation, '데스크톱 주 메뉴 렌더 영역 없음');
  assert.match(primaryNavigation, /MEGA_NAV\.map/);
  assert.match(primaryNavigation, /href=\{group\.simple \? group\.href : undefined\}/);
});

test('모바일 전체 메뉴는 검색과 그룹 탭 사이에 독립 /guide 행을 렌더한다', () => {
  const source = fs.readFileSync(path.join(navigationDir, 'mobile-nav-sheet.tsx'), 'utf8');
  const searchIndex = source.indexOf('className="mobile-nav-sheet-search"');
  const guideIndex = source.indexOf('className="mobile-nav-sheet-guide"');
  const tabsIndex = source.indexOf('className="mobile-nav-sheet-tabs"');

  assert.ok(searchIndex >= 0, '모바일 검색 행 없음');
  assert.ok(guideIndex > searchIndex, '사용방법 행은 검색 다음에 있어야 함');
  assert.ok(tabsIndex > guideIndex, '사용방법 행은 그룹 탭 앞에 있어야 함');
  assert.match(source.slice(guideIndex - 100, tabsIndex), /href="\/guide"/);
  assert.ok(
    source.slice(tabsIndex).includes("MEGA_NAV.filter((group) => group.label !== '사용방법')"),
    '사용방법은 4개 그룹 탭에서 제외되어야 함',
  );
});

test('모바일 사용방법 행은 최소 44px 터치 영역을 보장한다', () => {
  const source = fs.readFileSync(path.join(navigationDir, 'mobile-nav-sheet.css'), 'utf8');
  const guideRule = source.match(/\.mobile-nav-sheet-guide\s*\{([\s\S]*?)\}/)?.[1];

  assert.ok(guideRule, '모바일 사용방법 스타일 없음');
  assert.match(guideRule, /min-height:\s*44px/);
});
