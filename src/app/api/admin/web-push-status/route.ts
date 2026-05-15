// 2026-05-16 PR #142 — Web Push 운영 상태 진단 API.
// GET /api/admin/web-push-status → env 설정 여부 + 최근 7일 발송/클릭 통계.
import { NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { isWebPushConfigured } from '@/lib/web-push';

export async function GET() {
  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  // env 점검 — public key 는 길이만 노출, private key 는 boolean 만.
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? '';
  const env = {
    hasPublicKey: publicKey.length > 0,
    publicKeyLength: publicKey.length,
    hasPrivateKey: Boolean(process.env.WEB_PUSH_PRIVATE_KEY),
    hasSubject: Boolean(process.env.WEB_PUSH_SUBJECT),
    subjectStartsWithMailto: (process.env.WEB_PUSH_SUBJECT ?? '').startsWith('mailto:'),
    cronSecretPresent: Boolean(
      process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET
    ),
    fullyConfigured: isWebPushConfigured(),
    adminUserIdsCount: (process.env.ADMIN_USER_IDS ?? '')
      .split(',')
      .filter((s) => s.trim()).length,
  };

  // push_subscriptions 활성 개수.
  const { count: activeSubsCount } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  // 최근 7일 발송 + 클릭.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const { data: logs } = await supabase
    .from('notification_delivery_logs')
    .select('slot_key, status, clicked_at')
    .gte('created_at', cutoff.toISOString())
    .limit(20_000);

  const stats: Record<
    string,
    { sent: number; failed: number; clicked: number }
  > = {};
  for (const log of (logs ?? []) as Array<{
    slot_key: string;
    status: string;
    clicked_at: string | null;
  }>) {
    const slot = log.slot_key;
    if (!stats[slot]) stats[slot] = { sent: 0, failed: 0, clicked: 0 };
    if (log.status === 'sent') stats[slot].sent += 1;
    else if (log.status === 'failed') stats[slot].failed += 1;
    if (log.clicked_at) stats[slot].clicked += 1;
  }

  return NextResponse.json({
    ok: true,
    env,
    activeSubscriptions: activeSubsCount ?? 0,
    last7Days: stats,
  });
}
