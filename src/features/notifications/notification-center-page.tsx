'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Send } from 'lucide-react';
import {
  GangiActionRow,
  GangiIntro,
  GangiListLink,
  GangiMiniCard,
  GangiPageHeader,
  GangiSection,
} from '@/components/gangi/gangi-ui';
import {
  NOTIFICATION_SCHEDULE_BLUEPRINT,
  type NotificationSlotKey,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  getHonorificLabel,
  loadOnboardingDraft,
} from '@/features/saju-intake/onboarding-storage';
import type { NotificationSnapshot } from '@/lib/notifications';
import {
  createClient as createSupabaseClient,
  getCurrentBrowserUser,
} from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export type NotificationPageMode = 'center' | 'schedule' | 'widget';

type NotificationStyle = 'quiet' | 'normal' | 'sound';
type WidgetSize = 'small' | 'medium' | 'large';

interface NotificationPreferences {
  enabled: boolean;
  slots: Record<NotificationSlotKey, boolean>;
  style: NotificationStyle;
  widgetSize: WidgetSize;
  inactivityReminderDays: 3 | 5 | 7;
  lastSeenAt: string | null;
}

const NOTIFICATION_STORAGE_KEY = 'moonlight:notification-preferences';
const hasSupabaseBrowserEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const webPushPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? '';

const notificationRoutes: Record<NotificationSlotKey, { href: string; desc: string; label: string }> = {
  'today-fortune': {
    href: '/today-fortune',
    desc: '오늘 핵심 한 줄과 조심할 점',
    label: '오늘 보기',
  },
  'today-tarot': {
    href: '/tarot/daily',
    desc: '마음이 가는 카드 한 장',
    label: '타로 뽑기',
  },
  'today-zodiac': {
    href: '/zodiac',
    desc: '내 띠 기준 오늘 흐름',
    label: '띠운세 보기',
  },
};

function createDefaultPreferences(): NotificationPreferences {
  return {
    enabled: true,
    slots: Object.fromEntries(
      NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => [slot.key, true])
    ) as Record<NotificationSlotKey, boolean>,
    style: 'normal',
    widgetSize: 'medium',
    inactivityReminderDays: 3,
    lastSeenAt: null,
  };
}

function normalizeSlots(value: unknown) {
  const defaults = createDefaultPreferences().slots;
  if (!value || typeof value !== 'object') return defaults;

  const incoming = value as Record<string, unknown>;
  return Object.fromEntries(
    NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => [
      slot.key,
      typeof incoming[slot.key] === 'boolean'
        ? incoming[slot.key]
        : defaults[slot.key],
    ])
  ) as Record<NotificationSlotKey, boolean>;
}

function loadPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return createDefaultPreferences();

  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return createDefaultPreferences();

    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    const defaults = createDefaultPreferences();

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
      slots: normalizeSlots(parsed.slots),
      style:
        parsed.style === 'quiet' || parsed.style === 'normal' || parsed.style === 'sound'
          ? parsed.style
          : defaults.style,
      widgetSize:
        parsed.widgetSize === 'small' || parsed.widgetSize === 'medium' || parsed.widgetSize === 'large'
          ? parsed.widgetSize
          : defaults.widgetSize,
      inactivityReminderDays:
        parsed.inactivityReminderDays === 5 || parsed.inactivityReminderDays === 7
          ? parsed.inactivityReminderDays
          : defaults.inactivityReminderDays,
      lastSeenAt:
        typeof parsed.lastSeenAt === 'string' && parsed.lastSeenAt.length > 0
          ? parsed.lastSeenAt
          : null,
    };
  } catch {
    return createDefaultPreferences();
  }
}

function savePreferences(preferences: NotificationPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(preferences));
}

function normalizeServerPreferences(value: unknown): NotificationPreferences {
  const defaults = createDefaultPreferences();
  if (!value || typeof value !== 'object') return defaults;

  const data = value as Record<string, unknown>;

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaults.enabled,
    slots: normalizeSlots(data.slots),
    style:
      data.style === 'quiet' || data.style === 'normal' || data.style === 'sound'
        ? (data.style as NotificationStyle)
        : defaults.style,
    widgetSize:
      data.widgetSize === 'small' || data.widgetSize === 'medium' || data.widgetSize === 'large'
        ? (data.widgetSize as WidgetSize)
        : defaults.widgetSize,
    inactivityReminderDays:
      data.inactivityReminderDays === 5 || data.inactivityReminderDays === 7
        ? (data.inactivityReminderDays as 5 | 7)
        : defaults.inactivityReminderDays,
    lastSeenAt:
      typeof data.lastSeenAt === 'string' && data.lastSeenAt.length > 0
        ? data.lastSeenAt
        : null,
  };
}

function computeUpcomingLabel(slot: (typeof NOTIFICATION_SCHEDULE_BLUEPRINT)[number]) {
  const now = new Date();
  const next = new Date(now);

  if (slot.key === 'today-fortune') {
    next.setHours(8, 0, 0, 0);
  } else if (slot.key === 'today-tarot') {
    next.setHours(12, 0, 0, 0);
  } else {
    next.setHours(20, 0, 0, 0);
  }

  if (next <= now) next.setDate(next.getDate() + 1);

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(next);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export default function NotificationCenterPage({
  snapshot,
}: {
  mode: NotificationPageMode;
  snapshot: NotificationSnapshot;
}) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    createDefaultPreferences()
  );
  const [displayName, setDisplayName] = useState(snapshot.displayName);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isCurrentDeviceSubscribed, setIsCurrentDeviceSubscribed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isConnectingPush, setIsConnectingPush] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const honorific = useMemo(() => getHonorificLabel(displayName), [displayName]);

  useEffect(() => {
    const onboardingDraft = loadOnboardingDraft();
    const localPreferences = loadPreferences();
    const hydratedPreferences = {
      ...localPreferences,
      lastSeenAt: new Date().toISOString(),
    };

    if (onboardingDraft.nickname.trim()) {
      setDisplayName(onboardingDraft.nickname.trim());
    }

    setPreferences(hydratedPreferences);
    savePreferences(hydratedPreferences);

    if (typeof window !== 'undefined') {
      setPushSupported(
        'serviceWorker' in navigator &&
          'PushManager' in window &&
          window.isSecureContext
      );

      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !pushSupported) return;

    async function inspectSubscription() {
      try {
        const registration = await navigator.serviceWorker.register('/push-sw.js');
        const subscription = await registration.pushManager.getSubscription();
        setIsCurrentDeviceSubscribed(Boolean(subscription));
      } catch {
        setIsCurrentDeviceSubscribed(false);
      }
    }

    void inspectSubscription();
  }, [isHydrated, pushSupported]);

  useEffect(() => {
    if (!isHydrated || !hasSupabaseBrowserEnv) return;

    async function syncFromServer() {
      const supabase = createSupabaseClient();
      const user = await getCurrentBrowserUser(supabase);

      if (!user) {
        setIsLoggedIn(false);
        return;
      }

      setIsLoggedIn(true);

      try {
        const response = await fetch('/api/notifications/preferences', {
          cache: 'no-store',
        });

        if (!response.ok) return;

        const data = (await response.json()) as { preferences?: unknown };
        const nextPreferences = normalizeServerPreferences(data.preferences);
        const hydratedPreferences = {
          ...nextPreferences,
          lastSeenAt: new Date().toISOString(),
        };
        setPreferences(hydratedPreferences);
        savePreferences(hydratedPreferences);
      } catch {
        // 로컬 설정을 그대로 유지합니다.
      }
    }

    void syncFromServer();
  }, [isHydrated]);

  const enabledSlots = useMemo(
    () =>
      NOTIFICATION_SCHEDULE_BLUEPRINT.filter(
        (slot) => preferences.enabled && preferences.slots[slot.key]
      ),
    [preferences]
  );

  const nextUpcoming = enabledSlots[0]
    ? isHydrated
      ? computeUpcomingLabel(enabledSlots[0])
      : enabledSlots[0].timeLabel
    : '꺼짐';
  const pushReady = pushSupported && Boolean(webPushPublicKey);

  async function persistPreferences(next: NotificationPreferences) {
    setPreferences(next);
    savePreferences(next);

    if (!isLoggedIn) return;

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(data?.error ?? '알림 설정을 저장하지 못했습니다.');
      }
    } catch {
      setStatusMessage('네트워크 오류로 서버 저장을 마치지 못했습니다.');
    }
  }

  function updatePreferences(
    updater: (current: NotificationPreferences) => NotificationPreferences
  ) {
    const next = {
      ...updater(preferences),
      lastSeenAt: new Date().toISOString(),
    };
    void persistPreferences(next);
  }

  async function connectPush() {
    if (!pushSupported) {
      setStatusMessage('이 브라우저에서는 알림을 지원하지 않습니다.');
      return;
    }

    if (!webPushPublicKey) {
      setStatusMessage('웹 푸시 공개키가 아직 설정되지 않았습니다.');
      return;
    }

    if (!isLoggedIn) {
      setStatusMessage('알림 연결은 로그인 후 사용할 수 있습니다.');
      return;
    }

    setIsConnectingPush(true);
    setStatusMessage('');

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        setStatusMessage('브라우저 알림 권한이 허용되지 않았습니다.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js');
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(webPushPublicKey),
        });
      }

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(data?.error ?? '알림 기기를 저장하지 못했습니다.');
        return;
      }

      setIsCurrentDeviceSubscribed(true);
      setStatusMessage('이 브라우저에서 알림을 받을 수 있습니다.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '알림 연결에 실패했습니다.');
    } finally {
      setIsConnectingPush(false);
    }
  }

  async function disconnectPush() {
    if (!pushSupported || !isLoggedIn) return;

    setIsConnectingPush(true);
    setStatusMessage('');

    try {
      const registration = await navigator.serviceWorker.register('/push-sw.js');
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      setIsCurrentDeviceSubscribed(false);
      setStatusMessage('이 브라우저의 알림 연결을 해제했습니다.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '알림 연결 해제에 실패했습니다.'
      );
    } finally {
      setIsConnectingPush(false);
    }
  }

  async function sendTestPush() {
    if (!isLoggedIn) {
      setStatusMessage('테스트 알림은 로그인 후 보낼 수 있습니다.');
      return;
    }

    setIsSendingTest(true);
    setStatusMessage('');

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setStatusMessage(data?.error ?? '테스트 알림을 보내지 못했습니다.');
        return;
      }

      setStatusMessage('테스트 알림을 보냈습니다.');
    } catch {
      setStatusMessage('네트워크 오류로 테스트 알림을 보내지 못했습니다.');
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="알림" backHref="/" />

        <GangiIntro
          eyebrow="알림 설정"
          title={
            <>
              오늘 받을 알림만
              <br />
              고르세요
            </>
          }
          description="오늘운세, 오늘타로, 오늘띠만 짧게 보내드립니다."
        >
          <div className="gangi-mini-grid">
            <GangiMiniCard label="받는 알림" title={`${enabledSlots.length}개`} />
            <GangiMiniCard label="다음 알림" title={nextUpcoming} />
            <GangiMiniCard
              label="기기"
              title={isCurrentDeviceSubscribed ? '연결됨' : '미연결'}
            />
          </div>
        </GangiIntro>

        {statusMessage ? (
          <section className="gangi-card-panel mx-4 p-4 text-sm font-bold leading-6 text-[var(--app-ink)]">
            {statusMessage}
          </section>
        ) : null}

        <GangiSection
          eyebrow={preferences.enabled ? '전체 켜짐' : '전체 꺼짐'}
          title="받고 싶은 알림"
          description={`${honorific}께 필요한 알림만 남겼습니다.`}
        >
          <GangiActionRow>
            <button
              type="button"
              onClick={() =>
                updatePreferences((current) => ({
                  ...current,
                  enabled: !current.enabled,
                }))
              }
              className={preferences.enabled ? 'gangi-secondary-button' : 'gangi-primary-button'}
            >
              {preferences.enabled ? (
                <>
                  <BellOff className="h-4 w-4" />
                  전체 끄기
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  전체 켜기
                </>
              )}
            </button>
          </GangiActionRow>

          <div className="mt-4 space-y-3">
            {NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => {
              const route = notificationRoutes[slot.key];
              const enabled = preferences.enabled && preferences.slots[slot.key];

              return (
                <div
                  key={slot.key}
                  className={cn(
                    'rounded-[1.25rem] border bg-white p-4 shadow-[0_8px_24px_-18px_rgba(17,17,20,0.32)]',
                    enabled ? 'border-[var(--app-pink)]/36' : 'border-[var(--app-line)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.72rem] font-black text-[var(--app-pink-strong)]">
                        {slot.cadence} · {slot.timeLabel}
                      </p>
                      <h2 className="mt-1 text-lg font-black leading-7 text-[var(--app-ink)]">
                        {slot.title}
                      </h2>
                      <p className="mt-1 text-sm font-bold leading-6 text-[rgba(17,17,20,0.62)]">
                        {route.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updatePreferences((current) => ({
                          ...current,
                          slots: {
                            ...current.slots,
                            [slot.key]: !current.slots[slot.key],
                          },
                        }))
                      }
                      className={cn(
                        'min-w-16 rounded-full border px-3 py-1.5 text-xs font-black transition-colors',
                        enabled
                          ? 'border-[var(--app-pink)] bg-[var(--app-pink)] text-white'
                          : 'border-[var(--app-line)] bg-white text-[rgba(17,17,20,0.54)]'
                      )}
                    >
                      {enabled ? '받기' : '끔'}
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold leading-6 text-[rgba(17,17,20,0.7)]">
                      {slot.body}
                    </p>
                    <Link
                      href={route.href}
                      className="shrink-0 rounded-full border border-[var(--app-line)] bg-white px-3 py-2 text-xs font-black text-[var(--app-ink)]"
                    >
                      {route.label}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </GangiSection>

        <GangiSection
          eyebrow="기기 연결"
          title="브라우저 알림"
          description="로그인한 기기에서만 실제 알림이 저장됩니다."
          tone="pink"
        >
          <div className="grid gap-3">
            {[
              { label: '브라우저 지원', ready: pushSupported },
              { label: '푸시 키 설정', ready: Boolean(webPushPublicKey) },
              { label: '로그인 상태', ready: isLoggedIn },
              { label: '알림 권한', ready: permission === 'granted' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3"
              >
                <span className="text-sm font-black text-[var(--app-ink)]">{item.label}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black',
                    item.ready
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-[rgba(17,17,20,0.06)] text-[rgba(17,17,20,0.54)]'
                  )}
                >
                  {item.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  {item.ready ? '준비됨' : '확인 필요'}
                </span>
              </div>
            ))}
          </div>

          <GangiActionRow className="mt-4">
            <button
              type="button"
              onClick={isCurrentDeviceSubscribed ? disconnectPush : connectPush}
              disabled={isConnectingPush || !pushReady}
              className="gangi-primary-button disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isConnectingPush
                ? '처리 중...'
                : isCurrentDeviceSubscribed
                  ? '이 기기 알림 끄기'
                  : '이 기기 알림 켜기'}
            </button>
            <button
              type="button"
              onClick={sendTestPush}
              disabled={isSendingTest || !isCurrentDeviceSubscribed}
              className="gangi-secondary-button disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send className="h-4 w-4" />
              {isSendingTest ? '발송 중...' : '테스트'}
            </button>
          </GangiActionRow>
        </GangiSection>

        <div className="mx-4">
          <GangiListLink
            href="/free"
            zodiac="rooster"
            title="무료운세로 돌아가기"
            desc="오늘운세, 타로, 띠운세를 바로 볼 수 있어요"
          />
        </div>
      </AppPage>
    </AppShell>
  );
}
