import webPush from 'web-push';
import type { NotificationSlotKey } from '@/content/moonlight';
import { getHonorificLabel } from '@/lib/honorific';
import type { PushSubscriptionInput } from '@/lib/notification-preferences';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  slotKey: NotificationSlotKey;
}

function getWebPushConfig() {
  return {
    subject: process.env.WEB_PUSH_SUBJECT,
    publicKey: process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
    privateKey: process.env.WEB_PUSH_PRIVATE_KEY,
  };
}

export function isWebPushConfigured() {
  const config = getWebPushConfig();
  return Boolean(config.subject && config.publicKey && config.privateKey);
}

export function getWebPushPublicKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? '';
}

export function buildPushPayload(input: {
  slotKey: NotificationSlotKey;
  title: string;
  body: string;
  url?: string;
}) {
  return {
    title: input.title,
    body: input.body,
    url: input.url ?? '/notifications',
    tag: `moonlight-${input.slotKey}`,
    slotKey: input.slotKey,
  } satisfies PushPayload;
}

export function personalizeNotificationBody(
  body: string,
  displayName: string | null | undefined
) {
  return body.replace('선생님', getHonorificLabel(displayName ?? ''));
}

export async function sendWebPushNotification(
  subscription: PushSubscriptionInput,
  payload: PushPayload
) {
  const config = getWebPushConfig();

  if (!config.subject || !config.publicKey || !config.privateKey) {
    throw new Error('웹 푸시 VAPID 환경변수가 설정되지 않았습니다.');
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  return webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime,
      keys: subscription.keys,
    },
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      slotKey: payload.slotKey,
      icon: '/globe.svg',
      badge: '/globe.svg',
    })
  );
}
