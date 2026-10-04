// 2026-10-04 — 인플루언서(파트너) 등록·실적. super_admin 전용. partners/partner_visits 는 RLS deny → service 클라이언트.
//   migration 090 미적용이면 503 partners_table_missing (화면이 안내 문구를 띄운다).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { kstExclusiveEndIso, resolveAdminPeriod } from '@/lib/admin/metric-periods';
import { normalizePartnerCode } from '@/lib/partners/partner';
import { computePartnerStats, type PartnerOrderRow } from '@/lib/partners/partner-stats';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const ORDER_LIMIT = 2000;
const DEFAULT_HOST = 'infl-saju.com'; // 임시 자리표시 도메인 — 실제 도메인 구매 후 PARTNER_SITE_HOSTS 로 대체.

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /Could not find the table|does not exist/i.test(err.message ?? ''));
}

async function guard() {
  const check = await getCurrentAdminRole(await createClient());
  if (!check.ok) return NextResponse.json({ ok: false, error: check.reason }, { status: check.reason === 'unauthenticated' ? 401 : 403 });
  if (check.role !== 'super_admin') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  if (!hasSupabaseServiceEnv) return NextResponse.json({ ok: false, error: 'service env missing' }, { status: 500 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const period = resolveAdminPeriod(req.nextUrl.searchParams.get('unit'), req.nextUrl.searchParams.get('period'));
  const service = await createServiceClient();

  const { data: partners, error: pErr } = await service
    .from('partners')
    .select('code, name, discount_percent, commission_percent, active')
    .order('created_at', { ascending: true });
  if (pErr) {
    return isMissingTable(pErr)
      ? NextResponse.json({ ok: false, error: 'partners_table_missing' }, { status: 503, headers: NO_STORE })
      : NextResponse.json({ ok: false, error: pErr.message }, { status: 500, headers: NO_STORE });
  }

  const { data: visitRows, error: vErr } = await service
    .from('partner_visits')
    .select('partner_code, count')
    .gte('visited_on', period.startKey)
    .lte('visited_on', period.endKey);
  if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: isMissingTable(vErr) ? 503 : 500, headers: NO_STORE });
  const visits: Record<string, number> = {};
  for (const v of visitRows ?? []) visits[v.partner_code] = (visits[v.partner_code] ?? 0) + (Number(v.count) || 0);

  const { data: orders, error: oErr } = await service
    .from('payment_orders')
    .select('amount, status, metadata')
    .not('metadata->>partnerCode', 'is', null)
    .gte('confirmed_at', new Date(Date.parse(`${period.startKey}T00:00:00+09:00`)).toISOString())
    .lt('confirmed_at', kstExclusiveEndIso(period.endKey))
    .order('confirmed_at', { ascending: false })
    .limit(ORDER_LIMIT);
  if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 500, headers: NO_STORE });
  const stats = computePartnerStats((orders ?? []) as PartnerOrderRow[]);

  const host = (process.env.PARTNER_SITE_HOSTS ?? '').split(',').map((h) => h.trim()).find(Boolean) ?? DEFAULT_HOST;
  const empty = { paidCount: 0, paidWon: 0, refundedCount: 0, refundedWon: 0, commissionWon: 0 };
  return NextResponse.json(
    {
      ok: true,
      period,
      truncated: (orders?.length ?? 0) >= ORDER_LIMIT,
      partners: (partners ?? []).map((p) => ({
        code: p.code,
        name: p.name,
        discountPercent: p.discount_percent,
        commissionPercent: p.commission_percent,
        active: p.active,
        url: `https://${host}/${p.code}`,
        visits: visits[p.code] ?? 0,
        ...(stats[p.code] ?? empty),
      })),
    },
    { headers: NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const code = normalizePartnerCode(body?.code);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const discountPercent = Number(body?.discountPercent);
  const commissionPercent = Number(body?.commissionPercent);
  const active = body?.active !== false;
  if (
    !code ||
    name.length < 1 || name.length > 40 ||
    !Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 50 ||
    !Number.isInteger(commissionPercent) || commissionPercent < 0 || commissionPercent > 90
  ) {
    return NextResponse.json(
      { ok: false, error: '코드(영문 소문자·숫자 3~20자)·이름(1~40자)·할인(1~50, 상한 50%)·수수료(0~90)를 확인하세요.' },
      { status: 400 }
    );
  }
  const service = await createServiceClient();
  const { error } = await service
    .from('partners')
    .upsert({ code, name, discount_percent: discountPercent, commission_percent: commissionPercent, active }, { onConflict: 'code' });
  if (error) {
    return isMissingTable(error)
      ? NextResponse.json({ ok: false, error: 'partners_table_missing' }, { status: 503 })
      : NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, code });
}
