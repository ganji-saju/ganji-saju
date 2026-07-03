// 카카오 알림톡 배치 발송(cron). 현재: 구독 만료 임박(D-3/D-day) 정보성 알림톡.
// 인증: Authorization: Bearer <secret> 또는 x-kakao-secret (KAKAO_CRON_SECRET ?? CRON_SECRET).
// notifications/dispatch 와 동일한 cron-secret 패턴.
// 2026-07-03 — Vercel Cron 은 GET 으로 호출(+Bearer CRON_SECRET 자동 부착) → GET 도 지원.
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

async function handleDispatch(req: NextRequest) {
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
    // 2026-07-04 — 승인 템플릿(KA01TP…szkNn) 본문이 "#{plan} 멤버십이 #{days}일 이내
    // 만료됩니다."라 #{days}(숫자)로 발송. D-day 는 "0일 이내"가 어색해 "1일 이내"
    // (=오늘 만료, 의미상 참)로 매핑. 문구를 바꾸려면 템플릿 재심의 필요.
    const days = r.stage === 'd0' ? '1' : '3';
    const outcome = await sendAlimtalkToUser({
      userId: r.userId,
      templateCode,
      variables: { '#{plan}': planLabel, '#{days}': days },
      idempotencyKey: `sub_expiring:${r.userId}:${r.stage}:${r.renewsAt.slice(0, 10)}`,
      requireAdConsent: false, // 거래 고지성(정보) 알림톡
    });
    if (outcome.status === 'sent') sent += 1;
    else if (outcome.status === 'skipped') skipped += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, targets: targets.length, sent, skipped, failed });
}

// Vercel Cron(GET) + 수동 트리거(POST) 둘 다 지원.
export async function GET(req: NextRequest) {
  return handleDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleDispatch(req);
}
