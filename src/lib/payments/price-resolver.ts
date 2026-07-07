// 2026-07-07 — 런타임 가격 리졸버. 카탈로그(PAYMENT_PACKAGES) 기본가 위에
//   product_prices DB 오버라이드를 얹는다. 결제 주문 생성 시점 스냅샷에만 사용
//   (환불/이력/이행은 실결제액 유지 — 설계문서 참조).
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAYMENT_PACKAGES, getPackage, type PackageId } from './catalog';
import { createServiceClient } from '@/lib/supabase/server';

export interface ResolvedPrice {
  price: number;
  previousPrice: number | null;
}

export interface DbPriceRow {
  package_id: string;
  price: number;
  previous_price: number | null;
}

const VALID_IDS = new Set<string>(PAYMENT_PACKAGES.map((pkg) => pkg.id));

function catalogDefaults(): Map<PackageId, ResolvedPrice> {
  const map = new Map<PackageId, ResolvedPrice>();
  for (const pkg of PAYMENT_PACKAGES) {
    map.set(pkg.id, { price: pkg.price, previousPrice: null });
  }
  return map;
}

/** DB 행을 카탈로그 기본가 위에 병합. 카탈로그에 없는 id·비정수 price 는 무시. */
export function mergePricesWithDefaults(rows: DbPriceRow[] | null): Map<PackageId, ResolvedPrice> {
  const merged = catalogDefaults();
  for (const row of rows ?? []) {
    if (!VALID_IDS.has(row.package_id)) continue;
    if (!Number.isInteger(row.price) || row.price <= 0) continue;
    merged.set(row.package_id as PackageId, {
      price: row.price,
      previousPrice: row.previous_price ?? null,
    });
  }
  return merged;
}

export async function loadResolvedPrices(
  service: SupabaseClient
): Promise<Map<PackageId, ResolvedPrice>> {
  const { data, error } = await service
    .from('product_prices')
    .select('package_id, price, previous_price');
  if (error || !data) return catalogDefaults();
  return mergePricesWithDefaults(data as DbPriceRow[]);
}

function hasSupabaseServiceEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** per-request 캐시. env 없으면(CI/preview) 카탈로그 폴백. */
export const getResolvedPrices = cache(async (): Promise<Map<PackageId, ResolvedPrice>> => {
  if (!hasSupabaseServiceEnv()) return catalogDefaults();
  try {
    const service = await createServiceClient();
    return await loadResolvedPrices(service);
  } catch {
    return catalogDefaults();
  }
});

/** 단일 상품의 현재 가격(폴백 포함). */
export async function resolvePackagePrice(id: PackageId): Promise<number> {
  const prices = await getResolvedPrices();
  const resolved = prices.get(id);
  if (resolved) return resolved.price;
  return getPackage(id)?.price ?? 0;
}
