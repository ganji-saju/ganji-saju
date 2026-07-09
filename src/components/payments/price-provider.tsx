'use client';

// 2026-07-07 Phase 2 — 서버가 만든 가격 표시 맵을 클라 컴포넌트에 전파.
//   루트 레이아웃(서버)에서 getPriceDisplayMap() → <PriceProvider map>.
//   클라: usePriceLabel('taste_today_detail') 등. (server-only 코드 미import.)
import { createContext, useContext, type ReactNode } from 'react';
import {
  priceLabelFromMap,
  compareLabelFromMap,
  priceValueFromMap,
  type PriceDisplay,
  type PriceKey,
} from '@/lib/payments/price-display-shared';

type PriceMap = Record<string, PriceDisplay>;

const PriceContext = createContext<PriceMap>({});

export function PriceProvider({ map, children }: { map: PriceMap; children: ReactNode }) {
  return <PriceContext.Provider value={map}>{children}</PriceContext.Provider>;
}

export function usePriceMap(): PriceMap {
  return useContext(PriceContext);
}
export function usePriceLabel(key: PriceKey): string {
  return priceLabelFromMap(useContext(PriceContext), key);
}
export function useCompareLabel(key: PriceKey): string | null {
  return compareLabelFromMap(useContext(PriceContext), key);
}
export function usePriceValue(key: PriceKey): number {
  return priceValueFromMap(useContext(PriceContext), key);
}

// 서버·클라 어디서나 쓰는 가격 표시 리프. 루트 PriceProvider 컨텍스트에서 라벨을 읽어
//   admin(product_prices) 값으로 렌더한다. 서버 컴포넌트도 이 client 리프를 자식으로 둘 수 있다.
export function Price({ priceKey, className }: { priceKey: PriceKey; className?: string }) {
  const label = usePriceLabel(priceKey);
  return <span className={className}>{label}</span>;
}

// 취소선(compare-at) 원가. 값 없으면 아무것도 렌더 안 함.
export function ComparePrice({
  priceKey,
  className,
}: {
  priceKey: PriceKey;
  className?: string;
}) {
  const label = useCompareLabel(priceKey);
  if (!label) return null;
  return <span className={className}>{label}</span>;
}
