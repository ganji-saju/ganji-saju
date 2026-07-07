// 2026-07-07 Phase 2 — 가격 표시 레지스트리의 client-safe 순수 부분.
//   (서버 리졸버/Supabase 를 끌어오지 않는다 → 클라 컴포넌트/PriceProvider 에서 import 안전.)
import { PAYMENT_PACKAGES, getPackage, formatWon, type PackageId } from './catalog';
import type { ResolvedPrice } from './price-resolver';

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

function isSubscription(pkg: { kind: string; planSlug?: string } | undefined): boolean {
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

/** 순수: 리졸버 맵 → 전 상품 표시 정보. 서버 getPriceDisplayMap + 테스트 소스. */
export function buildPriceDisplayMap(
  resolved: Map<PackageId, ResolvedPrice>
): Record<PackageId, PriceDisplay> {
  const map = {} as Record<PackageId, PriceDisplay>;
  for (const pkg of PAYMENT_PACKAGES) {
    map[pkg.id] = buildDisplay(pkg.id, resolved.get(pkg.id));
  }
  return map;
}

// 직렬화된 맵(클라 PriceProvider·서버 모두)용 순수 조회 헬퍼.
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
