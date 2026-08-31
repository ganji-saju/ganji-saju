// 2026-08-31 — LLM 한도 경보 **발송**. 판정(llm-quota-alert)은 그대로 두고, 여기서
//   "언제 보내고 언제 참을지" 만 정한다. 배너는 관리자가 /admin 을 열어야 보였다 —
//   8/31 처럼 아무도 안 열면 그대로 사용자 제보를 기다리게 된다.
//
//   중복 방지 상태는 새 테이블 없이 notification_delivery_logs 에 남긴다
//   (slot_key='llm-quota-alert', title=level, body=headline, user_id null).
//   규칙: 같은 level 은 **KST 하루 한 번**. level 이 올라가면(warn→critical) 같은 날이라도 다시.
//   ok 로 내려가도 "복구" 메일은 보내지 않는다 — 조용해지는 게 곧 신호다(과잉 발송 방지).
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getLlmQuotaAlert, kstDateKey, type LlmQuotaAlert, type LlmQuotaAlertLevel } from './llm-quota-alert';
import { getOpsAlertRecipients, sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import { isEmailNotificationConfigured } from '@/lib/email/notification-email';

export const LLM_QUOTA_ALERT_SLOT_KEY = 'llm-quota-alert';

export interface LastQuotaAlertSent {
  level: LlmQuotaAlertLevel;
  sentAt: string;
}

/** 순수: 보낼지 판정. */
export function shouldSendLlmQuotaAlert(
  alert: Pick<LlmQuotaAlert, 'level'>,
  last: LastQuotaAlertSent | null,
  now: Date = new Date()
): boolean {
  if (alert.level === 'ok') return false;
  if (!last) return true;
  if (last.level !== alert.level) return true;
  return kstDateKey(new Date(last.sentAt)) !== kstDateKey(now);
}

export interface LlmQuotaNotifyResult {
  alert: LlmQuotaAlert;
  /** 'sent' | 'skipped:<이유>' | 'failed:<메시지>' */
  outcome: string;
  recipients: string[];
}

async function readLastSent(): Promise<LastQuotaAlertSent | null> {
  const service = await createServiceClient();
  const { data } = await service
    .from('notification_delivery_logs')
    .select('title, created_at')
    .eq('slot_key', LLM_QUOTA_ALERT_SLOT_KEY)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { title: string; created_at: string } | null;
  if (!row) return null;
  const level = row.title as LlmQuotaAlertLevel;
  if (level !== 'warn' && level !== 'critical') return null;
  return { level, sentAt: row.created_at };
}

async function writeLog(alert: LlmQuotaAlert, status: 'sent' | 'failed', responseStatus: number | null) {
  const service = await createServiceClient();
  const { error } = await service.from('notification_delivery_logs').insert({
    user_id: null,
    subscription_id: null,
    slot_key: LLM_QUOTA_ALERT_SLOT_KEY,
    title: alert.level,
    body: alert.headline,
    status,
    response_status: responseStatus,
  });
  if (error) console.warn('[llm-quota-notify] delivery log write failed', error.message);
}

/** 크론·수동 호출 진입점. 어떤 실패도 throw 하지 않는다(크론은 결과만 본다). */
export async function runLlmQuotaNotification(now: Date = new Date()): Promise<LlmQuotaNotifyResult> {
  const alert = await getLlmQuotaAlert(now);
  const recipients = getOpsAlertRecipients();

  if (!hasSupabaseServiceEnv) return { alert, outcome: 'skipped:no_service_env', recipients };
  if (!isEmailNotificationConfigured()) return { alert, outcome: 'skipped:email_not_configured', recipients };
  if (recipients.length === 0) return { alert, outcome: 'skipped:no_recipients', recipients };

  const last = await readLastSent().catch(() => null);
  if (!shouldSendLlmQuotaAlert(alert, last, now)) {
    return { alert, outcome: `skipped:${alert.level === 'ok' ? 'level_ok' : 'already_sent_today'}`, recipients };
  }

  const label = alert.level === 'critical' ? '[긴급]' : '[주의]';
  try {
    await sendOpsAlertEmail({
      subject: `${label} 간지사주 LLM — ${alert.headline}`,
      lines: [
        alert.detail,
        alert.recentQuotaFallbacks > 0
          ? `최근 이틀 한도 실패 ${alert.recentQuotaFallbacks}건 — 지금 사용자가 AI 답변을 받지 못하고 있습니다.`
          : '아직 사용자 실패 기록은 없습니다. 벤더 한도에 걸리기 전에 조치하세요.',
        `이 메일은 같은 단계(${alert.level})로는 하루 한 번만 옵니다. 단계가 올라가면 다시 옵니다.`,
      ],
      url: '/admin/llm-cost',
    }, { to: recipients });
    await writeLog(alert, 'sent', 200);
    return { alert, outcome: 'sent', recipients };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[llm-quota-notify] 발송 실패', { level: alert.level, message });
    await writeLog(alert, 'failed', null);
    return { alert, outcome: `failed:${message}`, recipients };
  }
}
