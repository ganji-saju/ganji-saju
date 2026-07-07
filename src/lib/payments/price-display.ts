// 2026-07-07 Phase 2 — 가격 표시 단일화 레지스트리. 화면에 보이는 모든 가격 문자열이
//   이 레지스트리(리졸버 기반)를 거쳐 admin 값(product_prices 오버라이드)을 따른다.
//   서버 컴포넌트: resolvePriceLabel/getPriceDisplayMap. 클라: PriceProvider + *FromMap.
import { cache } from 'react';
import { PAYMENT_PACKAGES, getPackage, formatWon, type PackageId } from './catalog';
import { getResolvedPrices, type ResolvedPrice } from './price-resolver';

// 특수키: 특정 카탈로그 상품이 아닌 표시 지점(브랜드 진입가 등)을 대표 상품에 매핑.
export type SpecialPriceKey = 'saju_entry';
export type PriceKey = PackageId | SpecialPriceKey;

const SPECIAL_TO_PACKAGE: Record<SpecialPriceKey, PackageId> = {
  // 브랜드 진입가("간지사주 9,900원") = 오늘 자세히(단품 대표가).
  saju_entry: 'taste_today_detail',
};

export function toPackageId(key: PriceKey): PackageId {
  return (SPECIAL_TO_PACKAGE as Record<string, PackageId>)[key] ?? (key as PackageId);
}

export interface PriceDisplay {
  value: number; // 청구가와 동일(리졸버 결과)
  label: string; // "9,900원" / 구독 "월 49,000원"
  compareValue: number | null; // 취소선 원가(previous_price ?? catalog.compareAt)
  compareLabel: string | null; // "69,000원"
}

function isSubscription(pkg: { kind: string; planSlug?: PackageId | string } | undefined): boolean {
  return Boolean(pkg && pkg.kind === 'subscription' && pkg.planSlug);
}

function buildDisplay(pkgId: PackageId, resolved: ResolvedPrice | undefined): PriceDisplay {
  const pkg = getPackage(pkgId);
  const value = resolved?.price ?? pkg?.price ?? 0;
  const label = isSubscription(pkg) ? `월 ${formatWon(value)}` : formatWon(value);
  const compareValue = resolved?.previousPrice ?? pkg?.compareAt ?? null;
  const compareLabel = compareValue != null ? formatWon(compareValue) : null;
  return { value, label, compareValue, compareLabel };
}

/** 순수: 리졸버 맵 → 전 상품 표시 정보. 테스트/클라 직렬화 소스. */
export function buildPriceDisplayMap(
  resolved: Map<PackageId, ResolvedPrice>
): Record<PackageId, PriceDisplay> {
  const map = {} as Record<PackageId, PriceDisplay>;
  for (const pkg of PAYMENT_PACKAGES) {
    map[pkg.id] = buildDisplay(pkg.id, resolved.get(pkg.id));
  }
  return map;
}

/** 서버: per-request 캐시된 전 상품 표시 맵. PriceProvider·서버 컴포넌트가 사용. */
export const getPriceDisplayMap = cache(
  async (): Promise<Record<PackageId, PriceDisplay>> => buildPriceDisplayMap(await getResolvedPrices())
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

// 클라(직렬화된 맵)용 순수 헬퍼 — PriceProvider hooks 가 래핑.
export function priceLabelFromMap(map: Record<string, PriceDisplay>, key: PriceKey): string {
  return map[toPackageId(key)]?.label ?? '';
}
export function compareLabelFromMap(
  map: Record<string, PriceDisplay>,
  key: PriceKey
): string | null {
  return map[toPackageId(key)]?.compareLabel ?? null;
}
export function priceValueFromMap(map: Record<string, PriceDisplay>, key: PriceKey): number {
  return map[toPackageId(key)]?.value ?? 0;
}
