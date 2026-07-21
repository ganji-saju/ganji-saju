// 2026-05-16 PR #142 — Web Push 운영 상태 진단 API.
// GET /api/admin/web-push-status → env 설정 여부 + 최근 7일 발송/클릭 통계.
import { NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import {
  createClient,
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
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
    hasServiceEnv: hasSupabaseServiceEnv,
  };

  // push 통계 집계는 service role 로. push_subscriptions / notification_delivery_logs 의
  // RLS 는 auth.uid()=user_id (본인 행만) 이라, 인증 가드용 anon 클라이언트로 조회하면
  // 관리자 본인 행만 보여 0 이 된다. 단 이 라우트는 env 진단이 주 목적이므로 service env
  // 가 없어도 env 는 항상 반환하고 집계만 건너뛴다(hasServiceEnv 로 상태 노출).
  let activeSubscriptions = 0;
  const stats: Record<
    string,
    { sent: number; failed: number; clicked: number }
  > = {};

  if (hasSupabaseServiceEnv) {
    const service = await createServiceClient();

    // push_subscriptions 활성 개수.
    const { count: activeSubsCount } = await service
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    activeSubscriptions = activeSubsCount ?? 0;

    // 최근 7일 발송 + 클릭.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const { data: logs } = await service
      .from('notification_delivery_logs')
      .select('slot_key, status, clicked_at')
      .gte('created_at', cutoff.toISOString())
      .limit(20_000);

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
  }

  return NextResponse.json({
    ok: true,
    env,
    activeSubscriptions,
    last7Days: stats,
  });
}
