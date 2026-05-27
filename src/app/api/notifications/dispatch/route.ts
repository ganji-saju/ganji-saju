import { NextRequest, NextResponse } from 'next/server';
import {
  NOTIFICATION_SCHEDULE_BLUEPRINT,
  type NotificationSlotKey,
} from '@/content/moonlight';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createNotificationDeliveryLog,
  listNotificationRecipients,
  markPushDeliveryResult,
} from '@/lib/notification-preferences';
import { deriveStarSignSlug } from '@/lib/profile-personalization';
import {
  buildExpiringPushBody,
  hasAlreadySentToday,
  listExpiringSubscribers,
  type ExpiringRecipient,
} from '@/lib/subscription-expiring';
import {
  buildComebackPushBody,
  hasRecentComebackSent,
  isEligibleForComeback,
} from '@/lib/comeback-reminder';
import { getSubscriptionPlanLabel } from '@/lib/subscription';
import { chooseVariantWithExploration } from '@/lib/star-sign/ab-winner';
import {
  computeStarSignDailyDigest,
  getStarSignPushBodyFor,
  type PushVariant,
} from '@/lib/star-sign/daily-digest';
import { toKstDateKey } from '@/lib/star-sign/daily-fortune';
import type { StarSignSlug } from '@/lib/star-sign/sign-content';
import {
  buildPushPayload,
  isWebPushConfigured,
  personalizeNotificationBody,
  sendWebPushNotification,
} from '@/lib/web-push';

// PR #137 — URL 에 ?notif=<logId> 첨부. 이미 query string 있으면 & 로 이어붙임.
// 외부 절대 URL 인 경우도 지원 (URL 생성자 사용 X — 상대 경로 그대로 유지).
function appendNotifId(url: string, logId: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}notif=${encodeURIComponent(logId)}`;
}

// 2026-05-16 PR #135 — KST 시간대 시각으로 슬롯 매칭.
// Vercel 서버가 UTC 라도 cron 트리거가 어느 시각에 오든 KST 시간대로 정확히 분기.
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
  if (hour === 10) due.add('subscription-expiring');
  if (hour === 12) due.add('today-tarot');
  if (hour === 19) due.add('comeback-reminder');
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

  // PR #143 — subscription-expiring 슬롯이 due 일 때 만료 임박 구독자 목록 미리 추출.
  // user_id 별 stage map 으로 dispatch loop 에서 빠르게 조회.
  let expiringMap: Map<string, ExpiringRecipient> | null = null;
  if (dueSlots.includes('subscription-expiring')) {
    const service = await createServiceClient();
    const expiring = await listExpiringSubscribers(service);
    expiringMap = new Map(expiring.map((e) => [e.userId, e]));
  }

  const results: Array<{
    userId: string;
    slotKey: NotificationSlotKey;
    sent: number;
    variant?: PushVariant | null;
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

      // PR #143 — subscription-expiring 슬롯은 만료 임박 구독자만 대상.
      // 그 외 사용자는 skip (전체 발송 X).
      if (slotKey === 'subscription-expiring') {
        if (!expiringMap || !expiringMap.has(recipient.userId)) {
          continue;
        }
      }

      // PR #144 — comeback-reminder 슬롯은 미접속 N일 이상 사용자만.
      // inactivityReminderDays 가 user 별 설정 (3/5/7).
      let comebackCandidate: { daysIdle: number } | null = null;
      if (slotKey === 'comeback-reminder') {
        comebackCandidate = isEligibleForComeback({
          lastSeenAt: recipient.preferences.lastSeenAt,
          inactivityReminderDays: recipient.preferences.inactivityReminderDays,
        });
        if (!comebackCandidate) continue;
        // 최근 cooldown(N/2일) 내 동일 슬롯 sent 있으면 skip.
        const svc = await createServiceClient();
        const recent = await hasRecentComebackSent(
          svc,
          recipient.userId,
          recipient.preferences.inactivityReminderDays
        );
        if (recent) continue;
      }

      // today-star-sign 은 사용자 생년월일 기반 별자리 운세를 동적으로 본문에 합성.
      // recipient.birthMonth/Day 가 있으면 deriveStarSignSlug → 본인 별자리 점수+highlight,
      // 없으면 일반 TOP sign 후보로 fallback. URL 도 본인 별자리로 link.
      // PR #136 — variant A/B/C 결정 후 본문 다양화 + delivery_logs 에 기록.
      let bodyText: string;
      let url = '/notifications';
      let variant: PushVariant | null = null;
      let titleText: string = blueprint.title;
      if (slotKey === 'today-star-sign' && starSignDigest) {
        const slug =
          recipient.birthMonth != null && recipient.birthDay != null
            ? (deriveStarSignSlug(recipient.birthMonth, recipient.birthDay) as StarSignSlug)
            : null;
        // PR #145 — ε-greedy A/B winner exploitation (90%) + exploration (10%).
        const choice = chooseVariantWithExploration(recipient.userId, toKstDateKey());
        variant = choice.variant;
        bodyText = personalizeNotificationBody(
          getStarSignPushBodyFor(slug, starSignDigest, variant),
          recipient.displayName || '선생님'
        );
        url = slug ? `/star-sign/${slug}` : '/star-sign';
      } else if (slotKey === 'comeback-reminder' && comebackCandidate) {
        const built = buildComebackPushBody(comebackCandidate);
        titleText = built.title;
        bodyText = personalizeNotificationBody(
          built.body,
          recipient.displayName || '선생님'
        );
        url = built.url;
      } else if (slotKey === 'subscription-expiring' && expiringMap) {
        const exp = expiringMap.get(recipient.userId)!;
        // 중복 발송 방지 — 같은 사용자에게 오늘 이미 같은 슬롯 send 됐으면 skip.
        // (dispatch 가 hour 매칭으로 1회만 trigger 되지만, 수동 dryRun 후 실발송 같은 시나리오 대비.)
        const service = await createServiceClient();
        if (await hasAlreadySentToday(service, recipient.userId, 'subscription-expiring')) {
          continue;
        }
        const built = buildExpiringPushBody({
          stage: exp.stage,
          planLabel: getSubscriptionPlanLabel(exp.plan),
        });
        titleText = built.title;
        bodyText = personalizeNotificationBody(
          built.body,
          recipient.displayName || '선생님'
        );
        url = built.url;
      } else {
        bodyText = personalizeNotificationBody(
          blueprint.body,
          recipient.displayName || '선생님'
        );
      }

      if (body?.dryRun) {
        results.push({
          userId: recipient.userId,
          slotKey,
          sent: recipient.subscriptions.length,
          variant,
        });
        continue;
      }

      let sent = 0;

      for (const subscription of recipient.subscriptions) {
        // PR #137 — server-side UUID 생성 후 URL 에 ?notif= 로 첨부.
        // 클라이언트가 진입 시 NotificationClickTracker 가 이 id 를 ack 로 POST.
        const logId = crypto.randomUUID();
        const urlWithNotif = appendNotifId(url, logId);
        const payload = buildPushPayload({
          slotKey,
          title: titleText,
          body: bodyText,
          url: urlWithNotif,
        });

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
              id: logId,
              userId: recipient.userId,
              subscriptionId: subscription.id,
              slotKey,
              title: payload.title,
              body: payload.body,
              status: 'sent',
              responseStatus: response.statusCode,
              variant,
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
              id: logId,
              userId: recipient.userId,
              subscriptionId: subscription.id,
              slotKey,
              title: payload.title,
              body: payload.body,
              status: 'failed',
              responseStatus: statusCode,
              variant,
            }),
          ]);
        }
      }

      results.push({
        userId: recipient.userId,
        slotKey,
        sent,
        variant,
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
