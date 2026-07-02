// 대행사(Solapi) 발송결과 webhook → kakao_message_log 상태갱신(vendor_msg_id 매칭).
// Solapi 는 웹훅 시크릿을 'X-Solapi-Secret' 헤더에 (해시로 변환해) 실어 보낸다.
// 대행사 방식(헤더-해시/헤더-평문/URL토큰) 어느 것이든 통과하도록 유연하게 검증한다.
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { kakaoConfig } from '@/lib/kakao/config';
import { mapVendorStatus } from '@/lib/kakao/webhook-status';

export const dynamic = 'force-dynamic';

function timingEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function sha256hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// 설정된 시크릿(SOLAPI_WEBHOOK_SECRET) 기준. 아래 중 하나라도 일치하면 통과:
//  1) URL `?token=<secret>`               — 우리가 URL 로 심는 경우(가장 확실)
//  2) X-Solapi-Secret == <secret>          — 평문, 또는 캡처한 해시값을 secret 으로 저장한 경우
//  3) X-Solapi-Secret == sha256(secret)    — Solapi 가 secret 을 SHA256 해시해 보내는 경우
function authorizeWebhook(req: NextRequest): boolean {
  const secret = kakaoConfig.webhookSecret;
  if (!secret) return false; // fail closed
  const token = new URL(req.url).searchParams.get('token');
  if (token && timingEqual(token, secret)) return true;
  const header = req.headers.get('x-solapi-secret') ?? req.headers.get('x-webhook-secret');
  if (!header) return false;
  return timingEqual(header, secret) || timingEqual(header, sha256hex(secret));
}

// Solapi 가 URL 등록 시 유효성 확인용 GET 을 보낼 수 있어 200 을 돌려준다(상태 변경 없음).
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  // fail closed: 시크릿 미설정이면 위조 방지를 위해 쓰기 자체를 거부.
  if (!kakaoConfig.webhookSecret) {
    return NextResponse.json({ ok: false, error: 'webhook_not_configured' }, { status: 503 });
  }
  if (!authorizeWebhook(req)) {
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
