import assert from 'node:assert/strict';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-07-19 — 상품 간 **가격 서열** 회귀 가드.
//
// 이 불변식이 두 번 깨졌다:
//   1) 3,300원 이벤트로 today-detail 이 내려가자 묶음(19,800)이 실가치(13,200)보다 비싸짐.
//   2) 묶음을 9,900 으로 내리자 이번엔 score-total(9,900)이 완전 열위가 됨
//      (묶음이 grandfather 로 점수 언락을 포함하면서 today-detail 까지 얹어줬다).
// 두 번 다 "가격 하나만 바꾸고 관계를 안 본" 탓이라, 관계 자체를 테스트로 고정한다.
//
// 핵심 등가식: 묶음 ≡ today-detail + 점수 언락
//   묶음 components = today-detail + score-factor F1~F5 이고,
//   score-unlock-access 의 grandfather 가 "F1~F5 전량 보유 = score-total 해제"로 인정한다.

function price(id: Parameters<typeof getPackage>[0]): number {
  const pkg = getPackage(id);
  assert.ok(pkg, `${id} 패키지가 카탈로그에 있어야 함`);
  return pkg.price;
}

test('가격 서열: 단품 < 점수 언락 < 묶음', () => {
  const detail = price('taste_today_detail');
  const scoreTotal = price('taste_score_total');
  const bundle = price('bundle_today_set');

  assert.ok(detail < scoreTotal, `단품(${detail}) < score-total(${scoreTotal}) 이어야 함`);
  assert.ok(scoreTotal < bundle, `score-total(${scoreTotal}) < 묶음(${bundle}) 이어야 함`);
});

test('묶음이 score-total 을 지배하지 않는다', () => {
  // 묶음 가격이 score-total 이하면, 같은 값(이하)에 점수 언락 + today-detail 을 주는 셈이라
  // score-total 을 사는 게 비합리적이 된다(strictly dominated).
  const scoreTotal = price('taste_score_total');
  const bundle = price('bundle_today_set');
  assert.ok(
    bundle > scoreTotal,
    `묶음(${bundle})이 score-total(${scoreTotal}) 이하면 score-total 이 완전 열위가 된다`
  );
});

test('묶음이 따로 사는 것보다 비싸지 않다', () => {
  // 반대 방향 가드: 묶음이 구성품 합계보다 비싸면 묶음을 살 이유가 사라진다.
  // (2026-07-18~19 사이 실제로 이 상태였다 — 묶음 19,800 vs 따로 13,200.)
  const parts = price('taste_today_detail') + price('taste_score_total');
  const bundle = price('bundle_today_set');
  assert.ok(
    bundle <= parts,
    `묶음(${bundle})이 따로 사기 합계(${parts})보다 비싸면 묶음이 무의미하다`
  );
});

// 2026-07-19 — 3,300원 이벤트가 이 6개 중 **2개(money_pattern·work_flow)를 건너뛰어**
//   /pricing 에서 나란히 놓인 같은 등급 상품이 3,300 / 9,900 으로 섞여 보였다.
//   사용자가 화면을 보고 발견했다 — 즉 리스트를 손으로 훑는 방식은 실패한다.
//   "형제는 같은 값"을 불변식으로 박아 다음 가격 변경 때 누락이 red 로 잡히게 한다.
const SIBLING_TASTE_PRODUCTS = [
  'taste_today_detail',
  'taste_love_question',
  'taste_money_pattern',
  'taste_work_flow',
  'taste_monthly_calendar',
  'taste_year_core',
] as const;

test('같은 등급 단품은 전부 같은 가격·같은 취소선', () => {
  const [head, ...rest] = SIBLING_TASTE_PRODUCTS;
  const base = getPackage(head);
  assert.ok(base, `${head} 가 카탈로그에 있어야 함`);

  for (const id of rest) {
    const pkg = getPackage(id);
    assert.ok(pkg, `${id} 가 카탈로그에 있어야 함`);
    assert.equal(
      pkg.price,
      base.price,
      `${id}(${pkg.price}) 가 형제 ${head}(${base.price}) 와 다르다 — 가격 변경 시 누락된 것 아닌가?`
    );
    assert.equal(
      pkg.compareAt ?? null,
      base.compareAt ?? null,
      `${id} 의 취소선이 형제 ${head} 와 다르다 — 한쪽만 할인 표시되면 나란히 놓였을 때 어색하다`
    );
  }
});

test('취소선 원가는 현재가보다 높다', () => {
  // compareAt <= price 면 "할인"이 자기모순이 된다. 취소선을 가진 전 상품에 적용.
  for (const id of [
    'taste_today_detail',
    'taste_love_question',
    'taste_monthly_calendar',
    'taste_year_core',
    'taste_score_total',
    'bundle_today_set',
    'lifetime_report',
  ] as const) {
    const pkg = getPackage(id);
    if (!pkg?.compareAt) continue;
    assert.ok(
      pkg.compareAt > pkg.price,
      `${id}: 취소선 ${pkg.compareAt} 이 현재가 ${pkg.price} 이하다`
    );
  }
});
