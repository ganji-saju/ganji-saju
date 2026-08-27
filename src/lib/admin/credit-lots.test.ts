import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

declare const test: (name: string, fn: () => void) => void;

// 2026-08-27 회귀 가드 — 🔴 "990원 결제하고 대화 3번 안 했는데 이미 사용된 거라고 환불이 안 되네".
//   실데이터는 멀쩡했고(잔여 6전) 목록 라벨도 '미사용 · 전액 환불 가능'이 맞게 나왔는데,
//   환불 실행만 거부됐다. 실행 경로가 lot 을 SQL 에서 미리 좁혀 넘겼고, 그 필터가 비면
//   판정이 "잔여 0전 = 전부 사용됨"으로 뒤집혀 그 문구가 그대로 400 본문이 됐다.
//
//   값 테스트로는 못 막는다 — 두 경로가 **각자 쿼리를 들고 있는 것** 자체가 결함이다.
//   그래서 소스를 직접 본다.
const FILES = [
  'src/app/api/admin/refund/route.ts', // 환불 실행
  'src/lib/admin/user-detail.ts', // 목록 화면
];

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

test('credit_lots 조회는 loadPurchaseCreditLots 한 곳으로만 — 경로별 자체 쿼리 금지', () => {
  for (const file of FILES) {
    const src = read(file);
    assert.ok(
      src.includes('loadPurchaseCreditLots'),
      `${file} 이 공용 로더를 쓰지 않는다 — 두 경로가 다른 후보 집합을 보면 판정이 갈린다`
    );
    assert.ok(
      !src.includes(".from('credit_lots')"),
      `${file} 이 credit_lots 를 직접 조회한다 — 조회는 credit-lots.ts 하나로 모을 것`
    );
  }
});

test('환불 판정 후보를 paymentKey 로 미리 좁히지 않는다(SQL 필터 금지)', () => {
  // .contains('metadata', { paymentKey }) 가 한 건도 못 잡으면 '전부 사용됨'으로 뒤집힌다.
  const src = read('src/app/api/admin/refund/route.ts');
  assert.ok(
    !/contains\(\s*'metadata'\s*,\s*\{\s*paymentKey/.test(src),
    'lot 후보를 SQL 로 좁히면 필터 실패가 곧 "환불 불가" 오판이 된다'
  );
});
