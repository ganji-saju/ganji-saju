// 2026-06-21 운영 — 결제 idempotency 회귀 데이터 감사. Vercel Cron(매일, CRON_SECRET)
//   또는 super_admin 수동 트리거. prod DB 조회라 service_role 사용.
//   회귀 감지 시 200 + 결과 JSON + 콘솔 경고(Vercel 로그 알림). 게이트 패턴은
//   admin/users/summary/refresh 와 동일.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { runPaymentIdempotencyAudit } from '@/lib/payments/idempotency-audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
  if (!isCronAuthorized(req)) {
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
  }

  const daysParam = Number.parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10);
  try {
    const result = await runPaymentIdempotencyAudit({
      sinceDays: Number.isFinite(daysParam) ? daysParam : 7,
    });
    if (!result.ok) {
      console.warn(
        `[payment-idempotency-audit] 회귀 ${result.rowCount}건 / overcharged ${result.totalOvercharged} 전 (since ${result.sinceIso})`,
        result.rows
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'audit_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
