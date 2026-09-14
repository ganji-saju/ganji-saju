// 2026-09-14 운영 — 멤버십 기간 원장(086) 드리프트 매일 점검(사용자 결정). Vercel Cron(매일 01:00 UTC = KST 10:00, CRON_SECRET)
//   또는 super_admin 수동 트리거. 인증은 payment-idempotency 감사와 동일.
//   어긋남 1명 이상 → 프로덕션 배포에서만 운영 메일(sendOpsAlertEmail). 메일 실패는 삼키지 않는다(로그 + 응답 alertError + 500).
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import { buildMembershipDriftAlert, runMembershipDriftAudit } from '@/lib/membership-drift';

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

  let drift;
  try {
    drift = await runMembershipDriftAudit();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'audit_failed';
    console.error('[membership-drift-audit] 조회 실패', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const body = {
    ok: drift.users.length === 0,
    chainVsRenews: drift.chainVsRenews.length,
    entitledWithoutEnd: drift.entitledWithoutEnd.length,
    users: drift.users,
    alerted: false,
  };
  if (body.ok) return NextResponse.json(body);

  console.warn(
    `[membership-drift-audit] 어긋남 ${drift.users.length}명 (chain_vs_renews ${body.chainVsRenews} · entitled_without_end ${body.entitledWithoutEnd})`,
    drift.users
  );
  if (process.env.VERCEL_ENV !== 'production') return NextResponse.json(body);
  try {
    await sendOpsAlertEmail(buildMembershipDriftAlert(drift));
    return NextResponse.json({ ...body, alerted: true });
  } catch (error) {
    const alertError = error instanceof Error ? error.message : 'alert_failed';
    console.error('[membership-drift-audit] 운영 메일 실패', alertError);
    return NextResponse.json({ ...body, alertError }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
