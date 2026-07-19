import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void) => void;

// 2026-07-20 — 궁합 전역권(love-question) **판매 중단** 가드.
//
// 왜 중단했나: 전역권은 1회 결제로 **모든 커플 영구** 해제라, 커플 1회권(compat-reading)과
//   같은 3,300원에 권한만 넓어 커플권이 완전 열위였다. 게다가 hasCompatibilityAccess 의
//   grandfather 가 전역권 보유자를 무조건 통과시키므로, 전역권을 계속 팔면 커플 단위 과금이
//   통째로 무의미해진다. 그래서 궁합 유료는 커플 1회권 단일로 통일했다.
//
// ⚠️ 이 가드는 **판매(신규 결제) 차단**만 지킨다. 기존 보유자의 열람은 grandfather 로 계속
//   허용돼야 하므로 compatibility-access.ts 의 love-question 판정은 남아 있는 게 정상이다.
//   (판매 중단 시점 실측 보유자 0명이지만, 과거 데이터가 다른 형태로 남아 있을 수 있어 유지)
function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('love-question: 판매 노출(TASTE_PRODUCTS)에서 빠져 있다', () => {
  const source = read('src/content/moonlight.ts');
  assert.ok(
    !/slug:\s*'love-question'/.test(source),
    "moonlight TASTE_PRODUCTS 에 love-question 이 되살아났다 — /pricing 등에 다시 노출된다"
  );
});

test('love-question: 체크아웃 딥링크가 남아 있지 않다', () => {
  for (const file of [
    'src/content/moonlight.ts',
    'src/content/gangi-market.ts',
    'src/features/compatibility/compatibility-result-view.tsx',
  ]) {
    assert.ok(
      !read(file).includes('product=love-question'),
      `${file} 에 love-question 결제 링크가 남아 있다`
    );
  }
});

test('love-question: 홈 궁합 카드가 커플권 가격을 쓴다', () => {
  const source = read('src/content/gangi-market.ts');
  assert.ok(
    !source.includes("priceKey: 'taste_love_question'"),
    '홈 카드가 판매 중단된 상품의 가격을 표시하고 있다'
  );
});

test('love-question: 서버(prepare)가 신규 결제를 막는다', () => {
  const source = read('src/app/api/payments/prepare/route.ts');
  assert.ok(
    source.includes("pkg.id === 'taste_love_question'"),
    'prepare 가드가 없으면 구 링크·직접 URL 로 계속 결제된다'
  );
  assert.ok(
    source.includes('love_question_retired'),
    '차단 사유가 퍼널에 기록돼야 잔존 유입을 관측할 수 있다'
  );
});

test('love-question: 카탈로그 항목 자체는 남는다(기존 보유자 판정·이력용)', () => {
  // 판매는 막되 상품 정의를 지우면 과거 주문·entitlement 조회가 깨진다.
  assert.ok(getPackage('taste_love_question'), 'taste_love_question 정의는 유지돼야 한다');
});

test('love-question: 열람 grandfather 는 유지된다', () => {
  const source = read('src/lib/payments/compatibility-access.ts');
  assert.ok(
    source.includes("'love-question'"),
    'grandfather 판정을 지우면 기존 구매자가 산 것을 못 본다 — 판매 중단과 열람 차단은 다르다'
  );
});
