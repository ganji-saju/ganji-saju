// 요약 테이블 갱신. Vercel Cron(매시간, CRON_SECRET) 또는 super_admin 수동.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { refreshAdminUserSummary } from '@/lib/admin/summary-refresh';

export const runtime = 'nodejs';
export const maxDuration = 300;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? null;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (!header) return false;
  return safeEqual(header, `Bearer ${secret}`);
}

async function handle(req: NextRequest) {
  if (isCronAuthorized(req)) {
    const result = await refreshAdminUserSummary();
    return NextResponse.json({ ok: true, ...result });
  }
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  if (check.role !== 'super_admin') {
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
