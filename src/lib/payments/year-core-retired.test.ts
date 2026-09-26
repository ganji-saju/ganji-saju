import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

// 2026-09-26 — 올해 핵심 3줄(year-core, 3,300원) **판매 중단** 가드. 2027 신년운세(19,900원)가 같은 연간 풀이에
//   가족·학업·분기·기대/조심까지 담는다 — 계속 팔면 신년운세를 3,300원에 사는 뒷문이 된다.
// ⚠️ 판매(신규 결제)만 막는다. 기존 보유자는 /api/interpret/yearly 의 basic 티어로 계속 연다(hasYearCoreEntitlementForReading 유지).
function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function srcFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) srcFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('year-core: 서버(prepare)가 신규 결제를 막고 사유를 퍼널에 남긴다', () => {
  const source = read('src/app/api/payments/prepare/route.ts');
  assert.ok(source.includes("pkg.id === 'taste_year_core'"));
  assert.ok(source.includes('year_core_retired'));
});

test('year-core: 결제 딥링크(product=year-core)가 src 어디에도 없다', () => {
  const hits = srcFiles(path.join(process.cwd(), 'src')).filter((f) => fs.readFileSync(f, 'utf8').includes('product=year-core'));
  assert.deepEqual(hits.map((f) => path.relative(process.cwd(), f)), []);
});

test('year-core: 기존 보유자 열람 판정은 남아 있다', () => {
  assert.ok(read('src/app/api/interpret/yearly/route.ts').includes('hasYearCoreEntitlementForReading'));
});
