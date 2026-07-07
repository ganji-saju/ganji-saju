// 2026-07-07 Phase 2 — 가격 표시 단일화 레지스트리(서버 진입점). 리졸버(product_prices
//   오버라이드)로 표시 맵을 만든다. 서버 컴포넌트: resolvePriceLabel/getPriceDisplayMap.
//   클라: PriceProvider + price-display-shared 의 *FromMap. (이 파일은 서버 전용 — 리졸버 import.)
import { cache } from 'react';
import { getResolvedPrices } from './price-resolver';
import {
  buildPriceDisplayMap,
  toPackageId,
  type PriceDisplay,
  type PriceKey,
} from './price-display-shared';
import type { PackageId } from './catalog';

// client-safe 순수 헬퍼/타입 재수출(서버 caller 편의).
export {
  buildPriceDisplayMap,
  toPackageId,
  priceLabelFromMap,
  compareLabelFromMap,
  priceValueFromMap,
  type PriceDisplay,
  type PriceKey,
  type SpecialPriceKey,
} from './price-display-shared';

/** 서버: per-request 캐시된 전 상품 표시 맵. PriceProvider·서버 컴포넌트가 사용. */
export const getPriceDisplayMap = cache(
  async (): Promise<Record<PackageId, PriceDisplay>> =>
    buildPriceDisplayMap(await getResolvedPrices())
);

export async function resolvePriceDisplay(key: PriceKey): Promise<PriceDisplay> {
  const map = await getPriceDisplayMap();
  return map[toPackageId(key)];
}
export async function resolvePriceLabel(key: PriceKey): Promise<string> {
  return (await resolvePriceDisplay(key)).label;
}
export async function resolveCompareLabel(key: PriceKey): Promise<string | null> {
  return (await resolvePriceDisplay(key)).compareLabel;
}
export async function resolvePriceValue(key: PriceKey): Promise<number> {
  return (await resolvePriceDisplay(key)).value;
}
