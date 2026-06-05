// 요약 테이블 갱신. Vercel Cron(매시간, CRON_SECRET) 또는 super_admin 수동.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { refreshAdminUserSummary } from '@/lib/admin/summary-refresh';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? null;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  let authorized = isCronAuthorized(req);
  if (!authorized) {
    const supabase = await createClient();
    const check = await getCurrentAdminRole(supabase);
    authorized = check.ok && check.role === 'super_admin';
  }
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const result = await refreshAdminUserSummary();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
