import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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

// 2026-07-20 — 묶음(bundle_today_set) **판매 중단** + 점수 언락 6,600 → 3,300.
//   기존 3개 테스트(서열 / 묶음 비지배 / 묶음 ≤ 합계)는 묶음을 파는 전제였으므로 폐기한다.
//   대신 단품 전 상품이 같은 값이라는 것과, 묶음이 되살아나면 알아채도록 하는 가드만 남긴다.
test('단품은 점수 언락까지 전부 같은 가격', () => {
  const detail = price('taste_today_detail');
  const scoreTotal = price('taste_score_total');
  assert.equal(
    scoreTotal,
    detail,
    `점수 언락(${scoreTotal})이 단품(${detail})과 다르다 — 단품 단일가 체계가 깨졌다`
  );
});

test('묶음은 판매하지 않는다(되살아나면 서열 재설계 필요)', () => {
  // 정의 자체는 남아 있다(기존 이용권·과거 주문 조회). 판매 재개는 prepare 가드를 걷어야 가능하다.
  const guard = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/payments/prepare/route.ts'),
    'utf8'
  );
  assert.ok(
    guard.includes("pkg.id === 'bundle_today_set'"),
    '묶음 판매 차단 가드가 사라졌다 — 묶음을 다시 팔려면 단품과의 서열부터 다시 정해야 한다'
  );
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
