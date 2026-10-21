// 랜딩 비회원 주문 보관 기간(1년) 삭제. Vercel Cron(매일, CRON_SECRET) 또는 super_admin 수동 실행.
//   게이트는 admin/audits/payment-idempotency 와 같다. 응답엔 건수만.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { purgeExpiredReportOrders } from '@/lib/report-orders/report-order-store';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization');
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    const check = await getCurrentAdminRole(await createClient());
    if (!check.ok) return NextResponse.json({ ok: false, error: check.reason }, { status: check.reason === 'unauthenticated' ? 401 : 403 });
    if (check.role !== 'super_admin') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await purgeExpiredReportOrders()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'purge_failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
