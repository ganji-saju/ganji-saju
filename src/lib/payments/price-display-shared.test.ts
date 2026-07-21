import assert from 'node:assert/strict';
import type { PackageId } from './catalog';
import type { ResolvedPrice } from './price-resolver';
import {
  buildPriceDisplayMap,
  compareLabelFromMap,
  tasteProductPriceKey,
  planPriceKey,
} from './price-display-shared';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 🔴 회귀 가드(2026-07-21) — /pricing·/membership 취소선(compare-at) 미렌더 수정.
//   product_prices 0행(런타임 오버라이드 없음) 이어도 catalog.compareAt 가 폴백돼
//   취소선 라벨이 조립돼야 한다. 페이지는 compareLabelFromMap 을 읽어 line-through 로 렌더한다.
//   (compareAt 를 카탈로그에만 넣고 라벨을 안 읽으면 할인이 화면에 전달되지 않는다.)
test('buildPriceDisplayMap: 오버라이드 없어도 catalog.compareAt 로 취소선 라벨 생성', () => {
  const map = buildPriceDisplayMap(new Map<PackageId, ResolvedPrice>());

  // taste 단품 이벤트가(3,300원) → 취소선 원가 9,900원.
  assert.equal(map.taste_today_detail!.compareLabel, '9,900원');
  assert.equal(
    compareLabelFromMap(map, tasteProductPriceKey('today-detail')),
    '9,900원'
  );

  // 보관형 리포트 lifetime_report → 취소선 69,000원.
  assert.equal(map.lifetime_report!.compareLabel, '69,000원');
  assert.equal(compareLabelFromMap(map, planPriceKey('lifetime')), '69,000원');

  // 멤버십 플랜은 compareAt 없음 → null(취소선 미표시가 정상 — 죽은 마크업을 붙이지 않는다).
  assert.equal(map.membership_premium!.compareLabel, null);
  assert.equal(compareLabelFromMap(map, planPriceKey('premium')), null);
});
