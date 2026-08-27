// 2026-08-27 — 관리자 타입 램프 회귀 가드.
//
//   이 화면이 "구분이 안 된다"고 느껴진 데는 두 가지가 겹쳐 있었다:
//   ① readability.css 가 !important 로 크기를 3단으로 뭉갠 것(제거 완료)
//   ② 소스 자체가 11.5 / 12.1 / 12.6 / 13.2 / 13.8 / 14.4 / 15 / 16.1 / 20.7 / 23 / 25.3 …
//      **31종**이라, 압축을 걷어내도 위계가 아니라 잡음이었던 것.
//
//   ②를 8종으로 정리했고, 다시 늘어나지 않게 여기서 막는다. 새 크기가 필요하면
//   먼저 램프(readability.css 의 --admin-t-*)를 고치고 이 목록에 추가해라 —
//   화면에서 임의 px 를 쓰는 순간 31종으로 돌아간다.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

declare const test: (name: string, fn: () => void) => void;

/** readability.css 의 --admin-t-* 와 짝이다. 한쪽만 바꾸면 어긋난다. */
const RAMP = new Set(['11', '11.5', '13', '14', '16', '20', '22', '28']);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

test('관리자 타입 램프: 화면이 램프 밖 크기를 쓰지 않는다', () => {
  const files = [...tsxFiles('src/app/admin'), ...tsxFiles('src/components/admin')];
  assert.ok(files.length > 20, `관리자 화면을 못 찾음(${files.length}개) — 경로 확인`);

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      if (!RAMP.has(m[1])) {
        const line = source.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line} text-[${m[1]}px]`);
      }
    }
  }
  assert.deepEqual(offenders, [], `램프 밖 크기 ${offenders.length}건:\n  ${offenders.join('\n  ')}`);
});
