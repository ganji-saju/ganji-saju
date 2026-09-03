// 2026-09-03 — 가짜 후기 재발 방지.
//
// 왜: /membership 에 "★★★★★ 4.8 · 멤버 후기 — 닭띠 · 1991" 이 **코드에 박혀** 있었다.
//   실제 후기 시스템(reviews 테이블 + ReviewList)이 멀쩡히 살아 있는데도, 그 자리엔
//   마케팅 문구가 실제 후기인 척 서 있었다. 게다가 1991년은 닭띠가 아니라 양띠(신미)라
//   같은 앱의 다른 화면과 정면으로 어긋났다.
//
//   ReviewList 는 0건이면 empty state 를 내도록 이미 설계돼 있다("가짜 후기 절대 금지" 스펙).
//   화면이 급하다고 별점을 하드코딩하면 그 설계가 조용히 무력화된다 — 여기서 막는다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const ROOTS = ['src/app', 'src/features', 'src/components'];
/** 실제 후기를 렌더하는 정본. 여기서만 별점을 그린다. */
const ALLOWED = ['src/components/review/'];

/** 블록 주석(JSX 포함)과 줄 주석 제거. 규칙의 배경을 주석에 적는 것을 막지 않기 위해서다. */
function stripComments(source: string): string {
  return source.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

test('가짜 후기 금지: 화면이 별점을 하드코딩하지 않는다', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    if (!statSync(root, { throwIfNoEntry: false })) continue;
    for (const file of tsxFiles(root)) {
      if (ALLOWED.some((allow) => file.startsWith(allow))) continue;
      // 주석 안의 사례 인용(왜 이 규칙이 생겼는지)은 허용한다 — 먼저 걷어낸다.
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const m of source.matchAll(/★{3,}/g)) {
        const lineStart = source.lastIndexOf('\n', m.index) + 1;
        const lineEnd = source.indexOf('\n', m.index);
        offenders.push(`${file}: ${source.slice(lineStart, lineEnd).trim().slice(0, 80)}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `별점을 직접 그리는 화면이 있다 — 실제 후기는 <ReviewList> 로 노출한다:\n  ${offenders.join('\n  ')}`
  );
});

test('가짜 후기 금지: /membership 은 ReviewList 로 실제 후기를 노출한다', () => {
  const page = readFileSync('src/app/membership/page.tsx', 'utf8');
  assert.ok(page.includes('<ReviewList'), '실제 후기 컴포넌트가 빠졌다');
  assert.ok(
    !/닭띠\s*·\s*1991/.test(page.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')),
    '주석 밖에 "닭띠 · 1991"(1991년은 양띠다)이 남아 있다'
  );
});
