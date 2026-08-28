// 🔴 2026-08-28 — 브랜드명 뒤 **조사** 회귀 가드.
//
//   옛 이름은 '달빛이'(달빛 + 이)였다. 이름 전체를 '간지사주'로 치환하면서 끝의 '이'를
//   조사로 착각해 남긴 자리가 세 곳 있었고, 그중 하나는 대화방에서 매 질문마다 떴다:
//     "간지사주이 답변을 정리하고 있습니다"
//   치환은 조용히 성공하고 문법만 깨진다 — 빌드도 타입도 안 잡아준다. 그래서 스캔한다.
//
//   ⚠️ '간지사주이다 / 간지사주입니다'(서술격)는 정상이다. 조사 뒤가 한글이면 건드리지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const BRAND = '간지사주';
/** 받침 없는 '주' 뒤에 올 수 없는 자음형 조사. */
const WRONG = ['이', '을', '은', '과', '으로'];
const SCAN_ROOT = path.join(process.cwd(), 'src');
const SKIP_DIRS = new Set(['node_modules', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('브랜드명 뒤 조사가 받침에 맞다(달빛이 → 간지사주 치환 자국)', () => {
  // 조사 직후가 한글이면 서술격('간지사주이다')이므로 제외한다.
  const re = new RegExp(`${BRAND}(${WRONG.join('|')})(?=[\\s.,!?)\\]}"'’”·…]|$)`, 'gu');
  const hits: string[] = [];

  for (const file of walk(SCAN_ROOT)) {
    if (file.endsWith('brand-josa.test.ts')) continue;
    const source = fs.readFileSync(file, 'utf8');
    source.split('\n').forEach((line, i) => {
      // 이 규칙을 설명하는 주석에는 예시가 들어간다 — 주석 줄은 건너뛴다.
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (re.test(line)) hits.push(`${path.relative(process.cwd(), file)}:${i + 1}  ${trimmed}`);
      re.lastIndex = 0;
    });
  }

  assert.deepEqual(hits, [], `브랜드명 뒤 조사가 틀렸다:\n${hits.join('\n')}`);
});
