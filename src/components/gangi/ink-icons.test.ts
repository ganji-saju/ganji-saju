// 2026-09-01 — 앱 전역 이모지 → 먹선 아이콘 세트 전환 가드.
//   ①데이터가 든 아이콘 이름이 세트에 실재하는지(오타 시 화면에서 아이콘이 조용히 사라진다)
//   ②아이콘 이름이 **글자 그대로 렌더**되지 않는지(실사고: 삼항 치환으로 'moon' 이 텍스트로 찍혔다)
//   ③사용자 표면에 컬러 이모지가 되살아나지 않는지
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const ROOT = process.cwd();
const ICON_SOURCE = fs.readFileSync(
  path.join(ROOT, 'src/components/gangi/ink-icons.tsx'),
  'utf8'
);

/** ICONS 맵에 등록된 이름 집합. */
function iconNames(): Set<string> {
  const block = ICON_SOURCE.slice(
    ICON_SOURCE.indexOf('const ICONS = {'),
    ICON_SOURCE.indexOf('} as const;', ICON_SOURCE.indexOf('const ICONS = {'))
  );
  const names = new Set<string>();
  for (const m of block.matchAll(/(?:^|[\s,{])'?([a-z][a-z-]*)'?\s*:/gm)) names.add(m[1]);
  return names;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(p);
  }
  return out;
}

test('세트에 최소 40종의 먹선 아이콘이 등록돼 있다', () => {
  const names = iconNames();
  assert.ok(names.size >= 40, `아이콘 ${names.size}종 — 세트가 축소됐다`);
  for (const must of ['solo', 'office', 'wealth', 'moon', 'chat', 'lock', 'face-good']) {
    assert.ok(names.has(must), `핵심 아이콘 누락: ${must}`);
  }
});

test('InkIcon 에 넘기는 리터럴 이름은 모두 세트에 존재한다', () => {
  const names = iconNames();
  const missing: string[] = [];
  for (const file of walk(path.join(ROOT, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<InkIcon[^>]*\bname="([^"]+)"/g)) {
      if (!names.has(m[1])) missing.push(`${path.relative(ROOT, file)}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, [], `세트에 없는 아이콘 이름: ${missing.join(', ')}`);
});

// 🔴 2026-09-01 실사고 — 하단 부채꼴 메뉴 아이콘이 통째로 사라졌다(대표 제보).
//   원인: InkIcon 이 모르는 이름을 null 로 삼켰는데, 그 메뉴는 라벨 첫 글자('무'·'타')와
//   '+' '?' '✦' 를 글리프로 쓴다. 이제는 모르는 이름이면 그 문자열을 그대로 그린다.
test('InkIcon 은 모르는 이름을 삼키지 않고 글리프로 그린다', () => {
  const impl = ICON_SOURCE.slice(ICON_SOURCE.indexOf('export function InkIcon'));
  assert.ok(
    !/return\s+Cmp\s*\?[^;]*:\s*null/.test(impl),
    'null 폴백이 되살아났다 — 라벨 첫 글자 글리프를 쓰는 메뉴가 통째로 사라진다'
  );
  assert.ok(impl.includes('{name}'), '모르는 이름을 그대로 그리는 폴백이 사라졌다');
});

test('네비게이션 글리프는 모두 아이콘 세트에 존재한다(폴백에 기대지 않는다)', () => {
  const names = iconNames();
  const nav = fs.readFileSync(
    path.join(ROOT, 'src/features/shared-navigation/site-header.tsx'),
    'utf8'
  );
  const block = nav.slice(nav.indexOf('const NAV_META'), nav.indexOf('};', nav.indexOf('const NAV_META')));
  const missing = [...block.matchAll(/glyph:\s*'([^']+)'/g)]
    .map((m) => m[1])
    .filter((g) => !names.has(g));
  assert.deepEqual(missing, [], `세트에 없는 네비 글리프: ${missing.join(', ')}`);
});

test('🔴 아이콘 이름이 글자 그대로 렌더되지 않는다', () => {
  // 실사고: 스윕이 `{isCenter ? '♥' : '☾'}` 를 `: 'moon'` 으로 바꿔 화면에 moon 이 찍혔다.
  const names = iconNames();
  const leaks: string[] = [];
  for (const file of walk(path.join(ROOT, 'src'))) {
    if (!file.endsWith('.tsx')) continue;
    const src = fs.readFileSync(file, 'utf8');
    // JSX 한 줄 삼항만 본다 — 여러 줄을 허용하면 TS 인터페이스(선택 속성 ?)까지 잡혀 오탐이 된다.
    for (const line of src.split('\n')) {
      const m = line.match(/\?\s*'([a-z][a-z-]+)'\s*:\s*'([a-z][a-z-]+)'/);
      if (m && (names.has(m[1]) || names.has(m[2]))) {
        leaks.push(`${path.relative(ROOT, file)}: ${line.trim().slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(leaks, [], `아이콘 이름이 텍스트로 샌다: ${leaks.join(' | ')}`);
});
