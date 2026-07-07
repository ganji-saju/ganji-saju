// 2026-07-07 — 전상품 가격 편집 API. super_admin 전용.
//   GET  /api/admin/pricing        — 전 상품 현재/과거가
//   POST /api/admin/pricing        — { packageId, price, previousPrice } 변경(즉시 반영 + 감사)
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  applyPriceChange,
  listProductPrices,
  validatePriceInput,
} from '@/lib/admin/product-pricing';

export const runtime = 'nodejs';

async function guardSuperAdmin(): Promise<
  { ok: true; userId: string | null } | { ok: false; res: NextResponse }
> {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: guard.reason },
        { status: guard.reason === 'unauthenticated' ? 401 : 403 }
      ),
    };
  }
  if (guard.role !== 'super_admin') {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: 'super_admin 권한이 필요합니다.' },
        { status: 403 }
      ),
    };
  }
  return { ok: true, userId: guard.userId };
}

export async function GET() {
  const g = await guardSuperAdmin();
  if (!g.ok) return g.res;
  const service = await createServiceClient();
  const items = await listProductPrices(service);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const g = await guardSuperAdmin();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = validatePriceInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const service = await createServiceClient();
  try {
    await applyPriceChange(service, { ...parsed.value, changedBy: g.userId ?? null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
  const items = await listProductPrices(service);
  return NextResponse.json({ ok: true, items });
}
