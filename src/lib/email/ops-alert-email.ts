// 2026-08-31 — 운영자 경보 이메일. 회원용 sendNotificationEmail 과 같은 Resend 경로지만
//   템플릿이 다르다(회원용은 "○○님," 인사와 "알림 수신 설정" 안내가 붙어 운영 경보에 맞지 않는다).
//
//   수신자: ADMIN_ALERT_EMAILS(콤마 구분). 없으면 INTERNAL_VERIFICATION_EMAILS 로 폴백 —
//   내부 이메일 목록이 이미 그 env 에 있어 오늘 당장 동작하게 하려는 것이고, 검증 페이지
//   허용목록과 경보 수신자를 갈라야 하면 ADMIN_ALERT_EMAILS 를 넣으면 된다.
import { Resend } from 'resend';

const SITE_ORIGIN = 'https://ganjisaju.kr';
const DEFAULT_FROM = '간지사주 <notifications@notify.ganjisaju.kr>';

type SendPayload = { from: string; to: string[]; subject: string; html: string };
type SendResult = { data: { id: string } | null; error: { message?: string } | null };

export interface OpsAlertEmailInput {
  subject: string;
  /** 본문 줄 — 각 줄이 문단이 된다. */
  lines: string[];
  /** 확인 링크(경로 또는 절대 URL). */
  url: string;
}

export interface OpsAlertEmailOptions {
  apiKey?: string;
  from?: string;
  to?: string[];
  send?: (payload: SendPayload) => Promise<SendResult>;
}

function parseEmailList(raw: string | undefined): string[] {
  return [...new Set((raw ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean))];
}

/** 순수: 수신자 목록. ADMIN_ALERT_EMAILS 우선, 없으면 INTERNAL_VERIFICATION_EMAILS. */
export function getOpsAlertRecipients(
  env: Record<string, string | undefined> = process.env
): string[] {
  const primary = parseEmailList(env.ADMIN_ALERT_EMAILS);
  return primary.length > 0 ? primary : parseEmailList(env.INTERNAL_VERIFICATION_EMAILS);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith('/') ? path : `/${path}`, SITE_ORIGIN).toString();
}

export async function sendOpsAlertEmail(input: OpsAlertEmailInput, options: OpsAlertEmailOptions = {}) {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY가 설정되지 않았습니다.');
  const to = options.to ?? getOpsAlertRecipients();
  if (to.length === 0) throw new Error('경보 수신자가 없습니다(ADMIN_ALERT_EMAILS).');

  const from = options.from ?? process.env.NOTIFICATION_EMAIL_FROM?.trim() ?? DEFAULT_FROM;
  const targetUrl = absoluteUrl(input.url);
  const paragraphs = input.lines
    .map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.7">${escapeHtml(line)}</p>`)
    .join('');
  const html = `<!doctype html>
<html lang="ko"><body style="margin:0;background:#f6f4f1;font-family:Arial,'Apple SD Gothic Neo',sans-serif;color:#1c1a17">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border:2px solid #c25438;border-radius:16px;padding:28px">
    <p style="margin:0 0 12px;color:#c25438;font-size:13px;font-weight:700">간지사주 운영 경보</p>
    <h1 style="margin:0 0 18px;font-size:22px;line-height:1.4">${escapeHtml(input.subject)}</h1>
    ${paragraphs}
    <a href="${escapeHtml(targetUrl)}" style="display:inline-block;margin-top:8px;border-radius:999px;background:#1c1a17;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px">관리자 콘솔 열기</a>
  </div>
  <p style="margin:18px 4px 0;color:#6b625c;font-size:12px;line-height:1.6">이 메일은 운영자 경보입니다. 수신자는 ADMIN_ALERT_EMAILS 로 관리합니다.</p>
</div></body></html>`;

  const send =
    options.send ??
    ((payload: SendPayload) => new Resend(apiKey).emails.send(payload) as Promise<SendResult>);
  const { data, error } = await send({ from, to, subject: input.subject, html });
  if (error || !data?.id) {
    throw new Error(error?.message || 'Resend 이메일 발송에 실패했습니다.');
  }
  return { id: data.id, to };
}
