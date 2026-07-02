// 대행사(Solapi) 발송결과 webhook → kakao_message_log 상태 갱신(vendor_msg_id 매칭).
// SOLAPI_WEBHOOK_SECRET 설정 시 x-webhook-secret 헤더 검증(미설정이면 통과).
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { kakaoConfig } from '@/lib/kakao/config';

export const dynamic = 'force-dynamic';

// 대행사 상태값 → 내부 상태.
function mapStatus(raw: string | undefined): 'sent' | 'failed' | 'substituted' | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (s.includes('COMPLETE') || s.includes('DELIVER') || s === 'SENT') return 'sent';
  if (s.includes('REPLACE') || s.includes('SUBSTITUT') || s.includes('SMS')) return 'substituted';
  if (s.includes('FAIL') || s.includes('ERROR') || s.includes('REJECT')) return 'failed';
  return null;
}

export async function POST(req: NextRequest) {
  if (kakaoConfig.webhookSecret) {
    const provided = req.headers.get('x-webhook-secret');
    if (provided !== kakaoConfig.webhookSecret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
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
    const status = mapStatus((report.status as string) ?? (report.statusCode as string));
    if (!vendorMsgId || !status) continue;
    const { error } = await supabase
      .from('kakao_message_log')
      .update({ status })
      .eq('vendor_msg_id', vendorMsgId);
    if (!error) updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
