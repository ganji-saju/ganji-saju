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
