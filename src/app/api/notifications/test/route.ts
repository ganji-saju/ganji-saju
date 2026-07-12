import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createNotificationDeliveryLog,
  createEmailDeliveryLog,
  getActivePushSubscriptionsForUser,
  getNotificationPreferencesForUser,
  markPushDeliveryResult,
} from '@/lib/notification-preferences';
import { getNotificationSnapshot } from '@/lib/notifications';
import {
  buildPushPayload,
  isWebPushConfigured,
  sendWebPushNotification,
} from '@/lib/web-push';
import {
  getTestNotificationDeliveryStatus,
  isEmailNotificationConfigured,
  sendNotificationEmail,
} from '@/lib/email/notification-email';

export async function POST() {
  if (!isWebPushConfigured() && !isEmailNotificationConfigured()) {
    return NextResponse.json(
      { error: '웹 푸시 또는 이메일 발송 환경변수가 아직 설정되지 않았습니다.' },
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
    const [subscriptions, snapshot, preferences] = await Promise.all([
      getActivePushSubscriptionsForUser(user.id),
      getNotificationSnapshot(),
      getNotificationPreferencesForUser(user.id),
    ]);

    const canSendPush = isWebPushConfigured() && subscriptions.length > 0;
    const canSendEmail =
      isEmailNotificationConfigured() && preferences.emailEnabled && Boolean(user.email);

    if (!canSendPush && !canSendEmail) {
      return NextResponse.json(
        { error: '연결된 브라우저 푸시 또는 수신 동의한 이메일이 없습니다.' },
        { status: 400 }
      );
    }

    const payload = buildPushPayload({
      slotKey: 'today-fortune',
      title: '간지사주 테스트 알림',
      body:
        snapshot.latestReading?.dailyLine ??
        `${snapshot.displayName}께 브라우저 푸시 연결이 정상적으로 완료되었습니다.`,
      url: snapshot.latestReading?.href ?? '/notifications',
    });

    const pushResults = canSendPush
      ? await Promise.all(
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
        )
      : [];

    let emailResult: { success: boolean; id?: string; failureReason?: string } | null = null;
    if (canSendEmail && user.email) {
      try {
        const email = await sendNotificationEmail({
          to: user.email,
          displayName: snapshot.displayName,
          title: payload.title,
          body: payload.body,
          url: payload.url,
        });
        await createEmailDeliveryLog({
          userId: user.id,
          slotKey: 'test',
          recipientEmail: user.email,
          providerMessageId: email.id,
          title: payload.title,
          body: payload.body,
          status: 'sent',
        });
        emailResult = { success: true, id: email.id };
      } catch (error) {
        const failureReason =
          error instanceof Error ? error.message : '테스트 이메일 발송에 실패했습니다.';
        await createEmailDeliveryLog({
          userId: user.id,
          slotKey: 'test',
          recipientEmail: user.email,
          title: payload.title,
          body: payload.body,
          status: 'failed',
          failureReason,
        });
        emailResult = { success: false, failureReason };
      }
    }

    const status = getTestNotificationDeliveryStatus(pushResults, emailResult);
    return NextResponse.json(
      {
        success: status === 200,
        pushResults,
        emailResult,
        ...(status === 200 ? {} : { error: '일부 알림 채널 발송에 실패했습니다.' }),
      },
      { status }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '테스트 알림을 보내지 못했습니다.' },
      { status: 500 }
    );
  }
}
