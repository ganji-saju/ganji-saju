import assert from 'node:assert/strict';
import { buildTasteProductHref } from './post-payment-redirect';
import { topicProductForConcern } from '@/app/api/today-fortune/unlock/route-helpers';

declare const test: (name: string, fn: () => void) => void;

// 2026-07-19 — 🔴 money-pattern·work-flow 는 **결제만 되고 여는 게이트가 앱 전체에 0곳**이었다.
//   getTasteProductEntitlement 호출 26곳 중 두 상품을 읽는 곳이 없었고,
//   결제 후 착지는 `/saju/new?topic=wealth`(입력폼, topic 을 읽지도 않음) 였다.
//   즉 돈을 받고 아무것도 주지 않는 상태. 3,300원 인하로 최저가 티어에 올라가면서 드러났다.
//   (다행히 실구매자 0명이었다)
//
//   전달물 = today-detail 화면의 해당 주제 슬라이스. 아래는 그 연결이 끊기면 red 가 되는 가드다.

test('주제 단품: 결제 후 착지가 today-detail 의 해당 주제로 간다', () => {
  const money = buildTasteProductHref('money-pattern', 'abc', null, null);
  assert.ok(money, 'money-pattern 착지가 null 이면 구매자가 갈 곳이 없다');
  assert.match(money, /\/saju\/abc\/today-detail/);
  assert.match(money, /topic=wealth/);

  const work = buildTasteProductHref('work-flow', 'abc', null, null);
  assert.ok(work, 'work-flow 착지가 null 이면 구매자가 갈 곳이 없다');
  assert.match(work, /\/saju\/abc\/today-detail/);
  assert.match(work, /topic=career/);
});

test('주제 단품: 착지가 입력폼(/saju/new)이면 안 된다', () => {
  for (const product of ['money-pattern', 'work-flow'] as const) {
    const href = buildTasteProductHref(product, 'abc', null, null);
    assert.ok(
      href && !href.startsWith('/saju/new'),
      `${product} 가 빈 입력폼으로 떨어진다 — 전달물 없음 회귀`
    );
  }
});

test('주제 ↔ 상품 매핑이 양방향으로 맞다', () => {
  assert.equal(topicProductForConcern('wealth'), 'money-pattern');
  assert.equal(topicProductForConcern('career'), 'work-flow');
  // 다른 주제로는 열리면 안 된다 — 재물을 샀는데 연애가 열리는 일이 없도록.
  for (const other of ['love', 'today', 'relationship', '', null, undefined]) {
    assert.equal(topicProductForConcern(other), null, `${String(other)} 는 주제 단품이 아니다`);
  }
});
