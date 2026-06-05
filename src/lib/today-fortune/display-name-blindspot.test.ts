import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-06-05 #3 (lint-name-only-blindspot) — '달빛이' 이름 fallback 이 surface 마다 raw 리터럴로
//   흩어져 있어 한 곳(#395/#396/스냅샷)을 고쳐도 다른 surface 에서 재발했다.
//   가드: 표시 이름 fallback 리터럴 `?? '달빛이'` 는 단일 상수(MOONLIGHT_FALLBACK_DISPLAY_NAME)
//   로만 표기한다. 새 surface 가 raw 리터럴을 도입하면 이 테스트가 실패해 blind spot 을 차단한다.
//   ※ 입력 placeholder("달빛이")·브랜드 카피·주석은 fallback 패턴이 아니므로 대상 아님.

const SRC_ROOT = path.resolve(__dirname, '../../');
const FALLBACK_LITERAL = /\?\?\s*['"]달빛이['"]/;

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    if (!entry.isFile()) return [];
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) return [];
    return [absolutePath];
  });
}

test("이름 fallback: raw `?? '달빛이'` 리터럴 금지 — 단일 상수만 사용(blind spot 차단)", () => {
  const offenders: string[] = [];
  for (const file of listSourceFiles(SRC_ROOT)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let inBlockComment = false;
    lines.forEach((line, index) => {
      let code = line;
      // 멀티라인 블록 주석(/* ... */, JSDoc 포함) 내부 줄은 실행 코드가 아니므로 제외.
      if (inBlockComment) {
        const end = code.indexOf('*/');
        if (end === -1) return;
        code = code.slice(end + 2);
        inBlockComment = false;
      }
      code = code.replace(/\/\*.*?\*\//g, '');
      const blockStart = code.indexOf('/*');
      if (blockStart !== -1) {
        code = code.slice(0, blockStart);
        inBlockComment = true;
      }
      code = code.replace(/\/\/.*$/, '');
      if (FALLBACK_LITERAL.test(code)) {
        offenders.push(`${path.relative(SRC_ROOT, file)}:${index + 1}`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `raw '달빛이' 이름 fallback 발견 — MOONLIGHT_FALLBACK_DISPLAY_NAME 를 import 해 사용하세요:\n${offenders.join('\n')}`
  );
});
