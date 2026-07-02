// 친구톡(광고성) 배치 발송(cron). 광고 수신동의 + 채널친구 대상.
// 준수: 야간(21~08 KST) 발송 금지 + (광고) 표기 + 무료수신거부는 send 레이어에서 처리.
// 인증: Authorization: Bearer <secret> 또는 x-kakao-secret (KAKAO_CRON_SECRET ?? CRON_SECRET).
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { sendFriendtalkToUser } from '@/lib/kakao/send';
import { isKakaoSendConfigured } from '@/lib/kakao/config';
import { isKakaoAdNightTime } from '@/lib/kakao/compliance';

export const dynamic = 'force-dynamic';

function authorize(req: NextRequest): boolean {
  const secret = process.env.KAKAO_CRON_SECRET ?? process.env.CRON_SECRET ?? null;
  if (!secret) return false;
  const authorization = req.headers.get('authorization');
  const headerSecret = req.headers.get('x-kakao-secret');
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

// 오늘의 운세 재방문 유도(광고성). (광고)/무료수신거부는 자동 부착.
const DAILY_BODY = '오늘의 운세가 도착했어요. 지금 확인해보세요 → https://ganjisaju.kr/today';

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!hasSupabaseServiceEnv) return NextResponse.json({ ok: true, skipped: 'no_service_env' });
  // 미설정이면 로그를 만들지 않고 조기 종료(완전 dormant).
  if (!isKakaoSendConfigured()) return NextResponse.json({ ok: true, skipped: 'not_configured' });
  // 배치 상단에서 야간(21~08 KST) 광고 차단 — 대량 부분발송·불필요 DB 쓰기 방지(정보통신망법).
  if (isKakaoAdNightTime(new Date())) return NextResponse.json({ ok: true, skipped: 'night_time' });

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('user_contact')
    .select('user_id')
    .eq('ad_consent', true)
    .not('phone', 'is', null)
    .limit(5000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const targets = (data ?? []) as Array<{ user_id: string }>;
  const kstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const t of targets) {
    const outcome = await sendFriendtalkToUser({
      userId: t.user_id,
      text: DAILY_BODY,
      idempotencyKey: `friendtalk_daily:${t.user_id}:${kstDate}`,
    });
    if (outcome.status === 'sent') sent += 1;
    else if (outcome.status === 'skipped') skipped += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, targets: targets.length, sent, skipped, failed });
}
