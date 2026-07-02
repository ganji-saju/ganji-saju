// 카카오 알림톡 배치 발송(cron). 현재: 구독 만료 임박(D-3/D-day) 정보성 알림톡.
// 인증: Authorization: Bearer <secret> 또는 x-kakao-secret (KAKAO_CRON_SECRET ?? CRON_SECRET).
// notifications/dispatch 와 동일한 cron-secret 패턴.
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { listExpiringSubscribers } from '@/lib/subscription-expiring';
import { sendAlimtalkToUser } from '@/lib/kakao/send';
import { kakaoConfig, isKakaoSendConfigured } from '@/lib/kakao/config';

export const dynamic = 'force-dynamic';

function authorize(req: NextRequest): boolean {
  const secret = process.env.KAKAO_CRON_SECRET ?? process.env.CRON_SECRET ?? null;
  if (!secret) return false;
  const authorization = req.headers.get('authorization');
  const headerSecret = req.headers.get('x-kakao-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

const PLAN_LABEL: Record<string, string> = {
  premium: '프리미엄',
  plus: '플러스',
};

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!hasSupabaseServiceEnv) return NextResponse.json({ ok: true, skipped: 'no_service_env' });
  // 미설정이면 로그를 만들지 않고 조기 종료(dormant 시 failed 로그 스팸 방지 — friendtalk 라우트와 동일).
  if (!isKakaoSendConfigured()) return NextResponse.json({ ok: true, skipped: 'not_configured' });

  const templateCode = kakaoConfig.templates.subscriptionExpiring;
  const supabase = await createServiceClient();
  const recipients = await listExpiringSubscribers(supabase);
  // 구독 만료 고지는 정보성. D-3/D-day 만 알림톡(D-7 은 push 로 충분).
  const targets = recipients.filter((r) => r.stage === 'd3' || r.stage === 'd0');

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of targets) {
    const planLabel = PLAN_LABEL[r.plan] ?? r.plan;
    const when = r.stage === 'd0' ? '오늘' : '3일 뒤';
    // 템플릿 변수(#{plan}=플랜명, #{when}=만료 시점 "오늘"/"3일 뒤").
    const outcome = await sendAlimtalkToUser({
      userId: r.userId,
      templateCode,
      variables: { '#{plan}': planLabel, '#{when}': when },
      idempotencyKey: `sub_expiring:${r.userId}:${r.stage}:${r.renewsAt.slice(0, 10)}`,
      requireAdConsent: false, // 거래 고지성(정보) 알림톡
    });
    if (outcome.status === 'sent') sent += 1;
    else if (outcome.status === 'skipped') skipped += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, targets: targets.length, sent, skipped, failed });
}
