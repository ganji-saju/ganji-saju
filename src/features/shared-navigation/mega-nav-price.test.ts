// 🔴 2026-08-28 — 메뉴 가격 배지가 **실제 청구가와 갈라지지 않게** 고정한다.
//
//   2026-08-28 실사고: '내 사주'에 `tagPriceKey: 'saju_entry'` 를 달았는데 그 키가
//   taste_today_detail(이벤트가 3,300원)로 매핑돼, 9,900원 상품이 메뉴에서 3,300원으로
//   보였다. 배지 문자열과 키를 사람이 각각 적는 한 또 갈라진다 — 관계를 테스트가 잡는다.
//
//   ⚠️ 배지 문자열은 **폴백**이다(런타임엔 admin product_prices 오버라이드가 우선).
//   그래도 폴백이 카탈로그와 다르면 그건 언제나 버그다.
import assert from 'node:assert/strict';
import { MEGA_NAV, type MegaNavItem } from './mega-nav-data';
import { getPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void) => void;

const BADGE_WORDS = new Set(['FREE', 'VIP', 'TOP']);

function allItems(): MegaNavItem[] {
  return MEGA_NAV.flatMap((group) => [
    ...(group.c1?.items ?? []),
    ...(group.c2?.items ?? []),
  ]).flatMap((item) => [item, ...(item.children ?? [])]);
}

test('가격 배지에는 반드시 tagPriceKey 가 붙는다', () => {
  for (const item of allItems()) {
    if (!item.tag || BADGE_WORDS.has(item.tag)) continue;
    assert.ok(
      item.tagPriceKey,
      `${item.label}: 가격 배지 '${item.tag}' 에 tagPriceKey 가 없다 — 가격이 바뀌어도 메뉴만 옛값으로 남는다`
    );
  }
});

test('가격 배지 문자열 = 그 키의 카탈로그 가격', () => {
  for (const item of allItems()) {
    if (!item.tagPriceKey || !item.tag || BADGE_WORDS.has(item.tag)) continue;
    const pkg = getPackage(item.tagPriceKey);
    assert.ok(pkg, `${item.label}: '${item.tagPriceKey}' 가 카탈로그에 없다`);
    assert.equal(
      item.tag,
      `${pkg.price.toLocaleString('ko-KR')}원`,
      `${item.label}: 배지(${item.tag})와 ${item.tagPriceKey} 실가(${pkg.price})가 다르다`
    );
  }
});

// 택일 3,300원(2026-08-28 신설) — 메뉴에 값을 붙였으면 실제로 받아야 한다.
//   2026-08-28 부분 유료화로 게이트가 **페이지 → API** 로 옮겨갔다: 상위 3일은 열고
//   나머지는 응답에서 잘라낸다. 자르는 곳이 서버가 아니면 잠금이 아니라 그림이다.
test('택일은 응답에서 잘라 잠근다(화면 블러가 아니라)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const api = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/taekil/find-good-days/route.ts'),
    'utf8'
  );
  assert.ok(
    api.includes("viewerHasMenuPass('taekil')"),
    '택일 API 가 이용권을 안 본다 — 메뉴가 3,300원이라고 광고하는데 전량 무료로 나간다'
  );
  assert.ok(
    api.includes('results.slice(0, FREE_TOP_N)'),
    '이용권 없는 응답이 전량을 내려보낸다 — 화면에서 가려도 JSON 에 답이 실린다'
  );
});
