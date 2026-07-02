// 대행사(Solapi) 발송결과 webhook → kakao_message_log 상태 갱신(vendor_msg_id 매칭).
// SOLAPI_WEBHOOK_SECRET 설정 시 x-webhook-secret 헤더 검증(미설정이면 통과).
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { kakaoConfig } from '@/lib/kakao/config';
import { mapVendorStatus } from '@/lib/kakao/webhook-status';

export const dynamic = 'force-dynamic';

// 길이 동일 시 상수시간 비교(타이밍 공격 완화).
function secretEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  // fail closed: 시크릿 미설정이면 위조 방지를 위해 쓰기 자체를 거부.
  if (!kakaoConfig.webhookSecret) {
    return NextResponse.json({ ok: false, error: 'webhook_not_configured' }, { status: 503 });
  }
  const provided = req.headers.get('x-webhook-secret');
  if (!provided || !secretEquals(provided, kakaoConfig.webhookSecret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!hasSupabaseServiceEnv) return NextResponse.json({ ok: true, skipped: 'no_service_env' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // Solapi 는 단건 또는 배열 리포트를 보낼 수 있음.
  const reports = Array.isArray(body) ? body : [body];
  const supabase = await createServiceClient();
  let updated = 0;

  for (const r of reports) {
    const report = (r ?? {}) as Record<string, unknown>;
    const vendorMsgId =
      (report.messageId as string) ?? (report.msgId as string) ?? (report.groupId as string);
    const status = mapVendorStatus((report.status as string) ?? (report.statusCode as string));
    if (!vendorMsgId || !status) continue;
    const { error } = await supabase
      .from('kakao_message_log')
      .update({ status })
      .eq('vendor_msg_id', vendorMsgId);
    if (!error) updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
