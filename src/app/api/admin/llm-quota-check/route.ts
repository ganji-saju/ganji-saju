// 2026-08-31 — GET /api/admin/llm-quota-check
//   Vercel Cron(매시 :20, CRON_SECRET) 또는 super_admin 수동 호출.
//   LLM 한도 경보를 판정하고 warn/critical 이면 운영자 이메일을 보낸다(중복 규칙은 llm-quota-notify).
//
//   ⚠️ 크론이 실제로 도는지는 vercel.json 등록 + 응답 로그로 확인할 것. 2026-06 에 canonical 301
//      때문에 모든 크론이 한 번도 안 돌았던 이력이 있다(#634) — "등록했으니 된다" 가 아니다.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { runLlmQuotaNotification } from '@/lib/admin/llm-quota-notify';

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

export async function GET(req: NextRequest) {
  let authorized = isCronAuthorized(req);
  if (!authorized) {
    const supabase = await createClient();
    const check = await getCurrentAdminRole(supabase);
    authorized = check.ok && check.role === 'super_admin';
  }
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await runLlmQuotaNotification();
  console.info('[llm-quota-check]', {
    level: result.alert.level,
    outcome: result.outcome,
    recipients: result.recipients.length,
  });
  return NextResponse.json({
    ok: true,
    level: result.alert.level,
    headline: result.alert.headline,
    outcome: result.outcome,
    recipientCount: result.recipients.length,
  });
}
