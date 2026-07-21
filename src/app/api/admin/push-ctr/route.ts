// 2026-05-16 PR #137 — 별자리 push 의 variant 별 CTR 집계.
// GET /api/admin/push-ctr?days=30 → { slot, variant, sent, clicked, ctr }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days');
  const days = Math.max(1, Math.min(180, parseInt(daysParam ?? '30', 10)));

  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  // 집계는 service role 로. notification_delivery_logs 의 RLS 는 auth.uid()=user_id
  // (본인 로그만) 이라, 인증 가드용 anon 클라이언트로 조회하면 관리자 본인 행만 보여 0 이 된다.
  if (!hasSupabaseServiceEnv) {
    return NextResponse.json(
      { ok: false, error: 'service env missing (SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 }
    );
  }
  const service = await createServiceClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await service
    .from('notification_delivery_logs')
    .select('slot_key, variant, status, clicked_at')
    .gte('created_at', cutoff.toISOString())
    .eq('status', 'sent')
    .limit(50_000);

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'query failed' },
      { status: 500 }
    );
  }

  // 집계 — (slot_key, variant) 별로 sent + clicked.
  const buckets = new Map<
    string,
    { slot: string; variant: string | null; sent: number; clicked: number }
  >();
  for (const row of data as Array<{
    slot_key: string;
    variant: string | null;
    clicked_at: string | null;
  }>) {
    const key = `${row.slot_key}|${row.variant ?? '-'}`;
    const bucket = buckets.get(key) ?? {
      slot: row.slot_key,
      variant: row.variant,
      sent: 0,
      clicked: 0,
    };
    bucket.sent += 1;
    if (row.clicked_at) bucket.clicked += 1;
    buckets.set(key, bucket);
  }

  const rows = Array.from(buckets.values()).map((b) => ({
    slot: b.slot,
    variant: b.variant,
    sent: b.sent,
    clicked: b.clicked,
    ctr: b.sent > 0 ? Number((b.clicked / b.sent).toFixed(4)) : 0,
  }));

  // 정렬: slot 가나다순 → variant.
  rows.sort((a, b) => {
    if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);
    return (a.variant ?? '').localeCompare(b.variant ?? '');
  });

  return NextResponse.json({
    ok: true,
    windowDays: days,
    totalSent: rows.reduce((s, r) => s + r.sent, 0),
    totalClicked: rows.reduce((s, r) => s + r.clicked, 0),
    rows,
  });
}
