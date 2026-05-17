import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createNotificationDeliveryLog,
  getActivePushSubscriptionsForUser,
  markPushDeliveryResult,
} from '@/lib/notification-preferences';
import { getNotificationSnapshot } from '@/lib/notifications';
import {
  buildPushPayload,
  isWebPushConfigured,
  sendWebPushNotification,
} from '@/lib/web-push';

export async function POST() {
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: '웹 푸시 VAPID 환경변수가 아직 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const [subscriptions, snapshot] = await Promise.all([
      getActivePushSubscriptionsForUser(user.id),
      getNotificationSnapshot(),
    ]);

    if (subscriptions.length === 0) {
      return NextResponse.json({ error: '연결된 브라우저 푸시 구독이 없습니다.' }, { status: 400 });
    }

    const payload = buildPushPayload({
      slotKey: 'today-fortune',
      title: '간지사주 테스트 알림',
      body:
        snapshot.latestReading?.dailyLine ??
        `${snapshot.displayName}께 브라우저 푸시 연결이 정상적으로 완료되었습니다.`,
      url: snapshot.latestReading?.href ?? '/notifications',
    });

    const results = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          const response = await sendWebPushNotification(subscription, payload);
          await Promise.all([
            markPushDeliveryResult({
              subscriptionId: subscription.id,
              endpoint: subscription.endpoint,
              success: true,
              statusCode: response.statusCode,
            }),
            createNotificationDeliveryLog({
              userId: user.id,
              subscriptionId: subscription.id,
              slotKey: payload.slotKey,
              title: payload.title,
              body: payload.body,
              status: 'sent',
              responseStatus: response.statusCode,
            }),
          ]);

          return {
            subscriptionId: subscription.id,
            statusCode: response.statusCode ?? 201,
            success: true,
          };
        } catch (error) {
          const statusCode =
            error && typeof error === 'object' && 'statusCode' in error
              ? Number((error as { statusCode?: unknown }).statusCode ?? 0) || undefined
              : undefined;
          const failureReason =
            error instanceof Error ? error.message : '테스트 푸시 발송에 실패했습니다.';

          await Promise.all([
            markPushDeliveryResult({
              subscriptionId: subscription.id,
              endpoint: subscription.endpoint,
              success: false,
              statusCode,
              failureReason,
            }),
            createNotificationDeliveryLog({
              userId: user.id,
              subscriptionId: subscription.id,
              slotKey: payload.slotKey,
              title: payload.title,
              body: payload.body,
              status: 'failed',
              responseStatus: statusCode,
            }),
          ]);

          return {
            subscriptionId: subscription.id,
            statusCode: statusCode ?? 500,
            success: false,
            failureReason,
          };
        }
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '테스트 알림을 보내지 못했습니다.' },
      { status: 500 }
    );
  }
}
