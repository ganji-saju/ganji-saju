import { NextRequest, NextResponse } from 'next/server';
import {
  NOTIFICATION_SCHEDULE_BLUEPRINT,
  type NotificationSlotKey,
} from '@/content/moonlight';
import {
  createNotificationDeliveryLog,
  listNotificationRecipients,
  markPushDeliveryResult,
} from '@/lib/notification-preferences';
import { deriveStarSignSlug } from '@/lib/profile-personalization';
import {
  computeStarSignDailyDigest,
  getStarSignPushBodyFor,
} from '@/lib/star-sign/daily-digest';
import type { StarSignSlug } from '@/lib/star-sign/sign-content';
import {
  buildPushPayload,
  isWebPushConfigured,
  personalizeNotificationBody,
  sendWebPushNotification,
} from '@/lib/web-push';

// 2026-05-16 PR #135 — KST 기준 시각으로 슬롯 매칭.
// Vercel 서버가 UTC 라도 cron 트리거가 어느 시각에 오든 KST 기준으로 정확히 분기.
function getKstHour(now: Date): number {
  const kstStr = now.toLocaleString('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    hour12: false,
  });
  const parsed = parseInt(kstStr, 10);
  return Number.isFinite(parsed) ? parsed : now.getUTCHours();
}

function resolveDueSlotKeys(now: Date) {
  const hour = getKstHour(now);
  const due = new Set<NotificationSlotKey>();

  if (hour === 8) due.add('today-fortune');
  if (hour === 9) due.add('today-star-sign');
  if (hour === 12) due.add('today-tarot');
  if (hour === 20) due.add('today-zodiac');

  return [...due];
}

function getSlotBlueprint(slotKey: NotificationSlotKey) {
  return (
    NOTIFICATION_SCHEDULE_BLUEPRINT.find((slot) => slot.key === slotKey) ??
    NOTIFICATION_SCHEDULE_BLUEPRINT[0]
  );
}

function isAuthorized(req: NextRequest) {
  const secret =
    process.env.NOTIFICATION_CRON_SECRET ?? process.env.CRON_SECRET ?? null;

  if (!secret) return true;

  const authorization = req.headers.get('authorization');
  const headerSecret = req.headers.get('x-notification-secret');

  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

async function handleDispatch(
  req: NextRequest,
  body?: { slotKey?: NotificationSlotKey; dryRun?: boolean } | null
) {
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: '웹 푸시 VAPID 환경변수가 아직 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 401 });
  }

  const now = new Date();
  const forcedSlot = body?.slotKey;
  const dueSlots = forcedSlot ? [forcedSlot] : resolveDueSlotKeys(now);
  const recipients = await listNotificationRecipients();

  // 2026-05-16 PR #135 — today-star-sign 슬롯이 due 일 때 한 번만 digest 계산해 모든 수신자에 재사용.
  const starSignDigest = dueSlots.includes('today-star-sign')
    ? computeStarSignDailyDigest()
    : null;

  const results: Array<{
    userId: string;
    slotKey: NotificationSlotKey;
    sent: number;
  }> = [];

  for (const recipient of recipients) {
    if (!recipient.preferences.enabled || recipient.subscriptions.length === 0) {
      continue;
    }

    const activeSlots = dueSlots.filter((slotKey) => {
      if (!recipient.preferences.slots[slotKey]) return false;
      return true;
    });

    for (const slotKey of activeSlots) {
      const blueprint = getSlotBlueprint(slotKey);

      // today-star-sign 은 사용자 생년월일 기반 별자리 운세를 동적으로 본문에 합성.
      // recipient.birthMonth/Day 가 있으면 deriveStarSignSlug → 본인 별자리 점수+highlight,
      // 없으면 일반 TOP sign 후보로 fallback. URL 도 본인 별자리로 link.
      let bodyText: string;
      let url = '/notifications';
      if (slotKey === 'today-star-sign' && starSignDigest) {
        const slug =
          recipient.birthMonth != null && recipient.birthDay != null
            ? (deriveStarSignSlug(recipient.birthMonth, recipient.birthDay) as StarSignSlug)
            : null;
        bodyText = personalizeNotificationBody(
          getStarSignPushBodyFor(slug, starSignDigest),
          recipient.displayName || '선생님'
        );
        url = slug ? `/star-sign/${slug}` : '/star-sign';
      } else {
        bodyText = personalizeNotificationBody(
          blueprint.body,
          recipient.displayName || '선생님'
        );
      }

      const payload = buildPushPayload({
        slotKey,
        title: blueprint.title,
        body: bodyText,
        url,
      });

      if (body?.dryRun) {
        results.push({
          userId: recipient.userId,
          slotKey,
          sent: recipient.subscriptions.length,
        });
        continue;
      }

      let sent = 0;

      for (const subscription of recipient.subscriptions) {
        try {
          const response = await sendWebPushNotification(subscription, payload);
          sent += 1;

          await Promise.all([
            markPushDeliveryResult({
              subscriptionId: subscription.id,
              endpoint: subscription.endpoint,
              success: true,
              statusCode: response.statusCode,
            }),
            createNotificationDeliveryLog({
              userId: recipient.userId,
              subscriptionId: subscription.id,
              slotKey,
              title: payload.title,
              body: payload.body,
              status: 'sent',
              responseStatus: response.statusCode,
            }),
          ]);
        } catch (error) {
          const statusCode =
            error && typeof error === 'object' && 'statusCode' in error
              ? Number((error as { statusCode?: unknown }).statusCode ?? 0) || undefined
              : undefined;
          const failureReason =
            error instanceof Error ? error.message : '웹 푸시 발송에 실패했습니다.';

          await Promise.all([
            markPushDeliveryResult({
              subscriptionId: subscription.id,
              endpoint: subscription.endpoint,
              success: false,
              statusCode,
              failureReason,
            }),
            createNotificationDeliveryLog({
              userId: recipient.userId,
              subscriptionId: subscription.id,
              slotKey,
              title: payload.title,
              body: payload.body,
              status: 'failed',
              responseStatus: statusCode,
            }),
          ]);
        }
      }

      results.push({
        userId: recipient.userId,
        slotKey,
        sent,
      });
    }
  }

  return NextResponse.json({
    success: true,
    dryRun: Boolean(body?.dryRun),
    dueSlots,
    results,
  });
}

export async function GET(req: NextRequest) {
  const slotKey = req.nextUrl.searchParams.get('slotKey');
  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';

  return handleDispatch(req, {
    slotKey:
      slotKey &&
      NOTIFICATION_SCHEDULE_BLUEPRINT.some((slot) => slot.key === slotKey)
        ? (slotKey as NotificationSlotKey)
        : undefined,
    dryRun,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { slotKey?: NotificationSlotKey; dryRun?: boolean }
    | null;

  return handleDispatch(req, body);
}
