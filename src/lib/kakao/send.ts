// 카카오 발송 오케스트레이션: 멱등 + 연락처 조회 + 로그 + 대행사 호출.
// 미설정/번호없음/동의없음/야간(광고)이면 발송하지 않고 로그에 사유만 남긴다
// (앱은 절대 실패시키지 않음).
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { isKakaoSendConfigured } from './config';
import { solapiSendAlimtalk, solapiSendFriendtalk } from './vendor';
import { isKakaoAdNightTime, formatFriendtalkAd } from './compliance';

export type SendOutcome =
  | { status: 'sent'; logId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string; logId?: string };

interface Prepared {
  supabase: SupabaseClient;
  logId: string;
  phone: string | null;
  adConsent: boolean;
  fail: (reason: string) => Promise<SendOutcome>;
}

// 멱등 확인 → 연락처 조회 → queued 로그 생성. skip 이면 SendOutcome 반환.
async function prepareSend(opts: {
  userId: string;
  kind: 'alimtalk' | 'friendtalk';
  templateCode: string | null;
  variables: Record<string, string>;
  idempotencyKey: string;
}): Promise<Prepared | SendOutcome> {
  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from('kakao_message_log')
    .select('id, status')
    .eq('idempotency_key', opts.idempotencyKey)
    .maybeSingle();
  if (existing) return { status: 'skipped', reason: `already:${existing.status}` };

  const { data: contact } = await supabase
    .from('user_contact')
    .select('phone, ad_consent')
    .eq('user_id', opts.userId)
    .maybeSingle();
  const phone: string | null = (contact?.phone as string | null) ?? null;

  const { data: inserted, error: insertError } = await supabase
    .from('kakao_message_log')
    .insert({
      user_id: opts.userId,
      to_phone: phone,
      kind: opts.kind,
      template_code: opts.templateCode,
      variables: opts.variables,
      status: 'queued',
      idempotency_key: opts.idempotencyKey,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    // 23505 = unique_violation → 동시성 경합에서 다른 요청이 먼저 큐잉(정상 스킵).
    // 그 외(컬럼/RLS/DB 장애)는 재시도/알림 대상이므로 failed 로 구분(스킵으로 감추지 않음).
    const code = (insertError as { code?: string } | null)?.code;
    if (code === '23505') return { status: 'skipped', reason: 'duplicate' };
    return { status: 'failed', reason: `insert_error:${insertError?.message ?? 'unknown'}` };
  }

  const logId = inserted.id as string;
  const fail = async (reason: string): Promise<SendOutcome> => {
    await supabase.from('kakao_message_log').update({ status: 'failed', error: reason }).eq('id', logId);
    return { status: 'failed', reason, logId };
  };

  return { supabase, logId, phone, adConsent: Boolean(contact?.ad_consent), fail };
}

async function markSent(
  supabase: SupabaseClient,
  logId: string,
  vendorMsgId: string | undefined
): Promise<void> {
  await supabase
    .from('kakao_message_log')
    .update({ status: 'sent', vendor_msg_id: vendorMsgId ?? null, sent_at: new Date().toISOString() })
    .eq('id', logId);
}

export interface SendAlimtalkParams {
  userId: string;
  templateCode: string;
  variables: Record<string, string>;
  /** 중복 발송 차단 키. 예: `payment_complete:${orderId}` */
  idempotencyKey: string;
  /** 광고성이면 true → ad_consent 필요(정보성 거래 알림은 false) */
  requireAdConsent?: boolean;
  enableSmsFallback?: boolean;
}

export async function sendAlimtalkToUser(params: SendAlimtalkParams): Promise<SendOutcome> {
  if (!hasSupabaseServiceEnv) return { status: 'skipped', reason: 'no_service_env' };

  const prep = await prepareSend({
    userId: params.userId,
    kind: 'alimtalk',
    templateCode: params.templateCode,
    variables: params.variables,
    idempotencyKey: params.idempotencyKey,
  });
  if ('status' in prep) return prep;

  if (!prep.phone) return prep.fail('no_phone');
  if (params.requireAdConsent && !prep.adConsent) return prep.fail('no_ad_consent');
  if (!isKakaoSendConfigured()) return prep.fail('not_configured');

  const result = await solapiSendAlimtalk({
    to: prep.phone,
    templateCode: params.templateCode,
    variables: params.variables,
    enableSmsFallback: params.enableSmsFallback,
  });
  if (!result.ok) return prep.fail(result.error ?? 'send_failed');

  await markSent(prep.supabase, prep.logId, result.vendorMsgId);
  return { status: 'sent', logId: prep.logId };
}

export interface SendFriendtalkParams {
  userId: string;
  /** 원문 본문. (광고)/무료수신거부는 내부에서 자동 부착. */
  text: string;
  idempotencyKey: string;
  imageId?: string;
}

export async function sendFriendtalkToUser(params: SendFriendtalkParams): Promise<SendOutcome> {
  // 광고성: 야간(21~08 KST) 발송 금지.
  if (isKakaoAdNightTime(new Date())) return { status: 'skipped', reason: 'night_time' };
  if (!hasSupabaseServiceEnv) return { status: 'skipped', reason: 'no_service_env' };

  const prep = await prepareSend({
    userId: params.userId,
    kind: 'friendtalk',
    templateCode: null,
    variables: {},
    idempotencyKey: params.idempotencyKey,
  });
  if ('status' in prep) return prep;

  if (!prep.phone) return prep.fail('no_phone');
  if (!prep.adConsent) return prep.fail('no_ad_consent'); // 광고성 → 동의 필수
  if (!isKakaoSendConfigured()) return prep.fail('not_configured');

  const result = await solapiSendFriendtalk({
    to: prep.phone,
    text: formatFriendtalkAd(params.text),
    imageId: params.imageId,
  });
  if (!result.ok) return prep.fail(result.error ?? 'send_failed');

  await markSent(prep.supabase, prep.logId, result.vendorMsgId);
  return { status: 'sent', logId: prep.logId };
}
