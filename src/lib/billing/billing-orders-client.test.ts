// payment_orders 는 RLS 켜짐·정책 없음(service 전용 원장)이라 세션 클라이언트로 읽으면 **오류 없이 0행**이다.
// 2026-07-04 에 넣은 결제 내역 보강(멤버십 결제)이 이 이유로 두 달간 한 번도 동작하지 않았다(2026-09-12 발견).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

test('결제 내역(getPaymentHistory)은 payment_orders 를 service 클라이언트로 읽는다', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../account.ts'), 'utf8');
  const reads = [...src.matchAll(/(\w+)\s*\.from\(\s*'payment_orders'\s*\)/g)].map((m) => m[1]);
  assert.ok(reads.length > 0, 'account.ts 에서 payment_orders 조회를 못 찾았다 — 옮겼으면 이 가드도 옮겨라');
  assert.deepEqual(reads.filter((client) => client !== 'service'), [], `세션 클라이언트로 읽는 곳: ${reads}`);
});
