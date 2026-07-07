// 2026-07-07 — /admin/pricing 백엔드 로직. 전 상품 가격 목록 + 변경 적용(upsert + 감사).
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAYMENT_PACKAGES, type PackageId } from '@/lib/payments/catalog';

export interface ProductPriceRow {
  packageId: PackageId;
  name: string;
  price: number;
  previousPrice: number | null;
  isOverridden: boolean;
  updatedAt: string | null;
}

interface DbRow {
  package_id: string;
  price: number;
  previous_price: number | null;
  updated_at: string;
}

const VALID_IDS = new Set<string>(PAYMENT_PACKAGES.map((p) => p.id));

export async function listProductPrices(service: SupabaseClient): Promise<ProductPriceRow[]> {
  const { data } = await service
    .from('product_prices')
    .select('package_id, price, previous_price, updated_at');
  const overrides = new Map<string, DbRow>();
  for (const row of (data as DbRow[] | null) ?? []) {
    if (VALID_IDS.has(row.package_id)) overrides.set(row.package_id, row);
  }
  return PAYMENT_PACKAGES.map((pkg) => {
    const o = overrides.get(pkg.id);
    return {
      packageId: pkg.id,
      name: pkg.name,
      price: o ? o.price : pkg.price,
      previousPrice: o ? o.previous_price : null,
      isOverridden: Boolean(o),
      updatedAt: o ? o.updated_at : null,
    };
  });
}

export interface ApplyPriceChangeInput {
  packageId: PackageId;
  price: number;
  previousPrice: number | null;
  changedBy: string | null;
}

export async function applyPriceChange(
  service: SupabaseClient,
  input: ApplyPriceChangeInput
): Promise<void> {
  // 감사 old_price = 현재 오버라이드가(없으면 카탈로그 기본가).
  const { data: current } = await service
    .from('product_prices')
    .select('price')
    .eq('package_id', input.packageId)
    .maybeSingle();
  const catalogDefault = PAYMENT_PACKAGES.find((p) => p.id === input.packageId)?.price ?? null;
  const oldPrice = (current as { price?: number } | null)?.price ?? catalogDefault;

  const { error: upsertError } = await service.from('product_prices').upsert(
    {
      package_id: input.packageId,
      price: input.price,
      previous_price: input.previousPrice,
      updated_at: new Date().toISOString(),
      updated_by: input.changedBy,
    },
    { onConflict: 'package_id' }
  );
  if (upsertError) throw new Error(`product_prices upsert 실패: ${upsertError.message}`);

  const { error: auditError } = await service.from('product_price_changes').insert({
    package_id: input.packageId,
    old_price: oldPrice,
    new_price: input.price,
    previous_price: input.previousPrice,
    changed_by: input.changedBy,
  });
  if (auditError) throw new Error(`product_price_changes insert 실패: ${auditError.message}`);
}

export type ValidatedPriceInput = {
  packageId: PackageId;
  price: number;
  previousPrice: number | null;
};

export function validatePriceInput(
  raw: { packageId?: unknown; price?: unknown; previousPrice?: unknown } | null
): { ok: true; value: ValidatedPriceInput } | { ok: false; error: string } {
  const packageId = raw?.packageId;
  const price = raw?.price;
  const previousPrice = raw?.previousPrice;

  if (typeof packageId !== 'string' || !VALID_IDS.has(packageId)) {
    return { ok: false, error: `알 수 없는 상품: ${String(packageId)}` };
  }
  if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0) {
    return { ok: false, error: '변경가격은 1 이상의 정수여야 합니다.' };
  }
  let prev: number | null = null;
  if (previousPrice !== null && previousPrice !== undefined && previousPrice !== '') {
    if (
      typeof previousPrice !== 'number' ||
      !Number.isInteger(previousPrice) ||
      previousPrice <= 0
    ) {
      return { ok: false, error: '과거가격은 비우거나 1 이상의 정수여야 합니다.' };
    }
    prev = previousPrice;
  }
  return { ok: true, value: { packageId: packageId as PackageId, price, previousPrice: prev } };
}
