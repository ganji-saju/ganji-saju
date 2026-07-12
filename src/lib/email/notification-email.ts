import { Resend } from 'resend';

const SITE_ORIGIN = 'https://ganjisaju.kr';
const DEFAULT_FROM = '간지사주 <notifications@notify.ganjisaju.kr>';

type SendPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
};

type SendResult = {
  data: { id: string } | null;
  error: { message?: string } | null;
};

type EmailOptions = {
  apiKey?: string;
  from?: string;
  send?: (payload: SendPayload) => Promise<SendResult>;
};

export type NotificationEmailInput = {
  to: string;
  displayName: string;
  title: string;
  body: string;
  url: string;
};

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

export function isEmailNotificationConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getTestNotificationDeliveryStatus(
  pushResults: Array<{ success: boolean }>,
  emailResult: { success: boolean } | null
) {
  return pushResults.some((result) => !result.success) || emailResult?.success === false
    ? 502
    : 200;
}

export async function sendNotificationEmail(
  input: NotificationEmailInput,
  options: EmailOptions = {}
) {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY가 설정되지 않았습니다.');

  const from = options.from ?? process.env.NOTIFICATION_EMAIL_FROM?.trim() ?? DEFAULT_FROM;
  const displayName = input.displayName.trim() || '회원';
  const targetUrl = absoluteUrl(input.url);
  const html = `<!doctype html>
<html lang="ko"><body style="margin:0;background:#fff7f4;font-family:Arial,'Apple SD Gothic Neo',sans-serif;color:#2d2523">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border:1px solid #f1ddd7;border-radius:20px;padding:28px">
    <p style="margin:0 0 12px;color:#d96f5d;font-size:14px;font-weight:700">간지사주 알림</p>
    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.4">${escapeHtml(input.title)}</h1>
    <p style="margin:0 0 12px;font-size:16px;line-height:1.7">${escapeHtml(displayName)}님,</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7">${escapeHtml(input.body)}</p>
    <a href="${escapeHtml(targetUrl)}" style="display:inline-block;border-radius:999px;background:#e87867;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px">간지사주에서 확인하기</a>
  </div>
  <p style="margin:18px 4px 0;color:#8b7a75;font-size:12px;line-height:1.6">알림 수신 설정은 간지사주 알림 설정에서 언제든 변경할 수 있습니다.</p>
</div></body></html>`;

  const send =
    options.send ??
    ((payload: SendPayload) =>
      new Resend(apiKey).emails.send(payload) as Promise<SendResult>);
  const { data, error } = await send({
    from,
    to: [input.to],
    subject: input.title,
    html,
  });

  if (error || !data?.id) {
    throw new Error(error?.message || 'Resend 이메일 발송에 실패했습니다.');
  }

  return { id: data.id };
}
