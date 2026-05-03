'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  Clock3,
  MoonStar,
  Send,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { ActionCluster } from '@/components/layout/action-cluster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import {
  HOME_WIDGET_BLUEPRINT,
  NOTIFICATION_SCHEDULE_BLUEPRINT,
  RETENTION_SCENARIOS,
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
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

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

function loadPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return createDefaultPreferences();

  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return createDefaultPreferences();

    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    const defaults = createDefaultPreferences();
    const slots = Object.fromEntries(
      NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => [
        slot.key,
        typeof parsed.slots?.[slot.key] === 'boolean'
          ? parsed.slots[slot.key]
          : defaults.slots[slot.key],
      ])
    ) as Record<NotificationSlotKey, boolean>;

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
      slots,
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
  const slots =
    data.slots && typeof data.slots === 'object'
      ? Object.fromEntries(
          NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => [
            slot.key,
            typeof (data.slots as Record<string, unknown>)[slot.key] === 'boolean'
              ? (data.slots as Record<string, boolean>)[slot.key]
              : defaults.slots[slot.key],
          ])
        )
      : defaults.slots;

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaults.enabled,
    slots: slots as Record<NotificationSlotKey, boolean>,
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

function formatVisitedDistance(lastSeenAt: string | null) {
  if (!lastSeenAt) return '이번이 첫 방문입니다.';

  const previous = new Date(lastSeenAt).getTime();
  const diffDays = Math.floor((Date.now() - previous) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return '오늘 다시 들어오셨습니다.';
  if (diffDays === 1) return '하루 만에 다시 돌아오셨습니다.';
  return `${diffDays}일 만에 다시 돌아오셨습니다.`;
}

function computeUpcomingLabel(slot: (typeof NOTIFICATION_SCHEDULE_BLUEPRINT)[number]) {
  const now = new Date();
  const next = new Date(now);

  if (slot.key === 'morning') {
    next.setHours(7, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (slot.key === 'lunch') {
    next.setHours(12, 30, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (slot.key === 'evening') {
    next.setHours(20, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else {
    return slot.timeLabel;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(next);
}

function buildScheduleBody(body: string, honorific: string) {
  return body.replace('선생님', honorific);
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
  mode,
  snapshot,
}: {
  mode: NotificationPageMode;
  snapshot: NotificationSnapshot;
}) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    createDefaultPreferences()
  );
  const [displayName, setDisplayName] = useState(snapshot.displayName);
  const [previousSeenAt, setPreviousSeenAt] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isCurrentDeviceSubscribed, setIsCurrentDeviceSubscribed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isConnectingPush, setIsConnectingPush] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [widgetDateLabel, setWidgetDateLabel] = useState('오늘의 흐름');
  const honorific = useMemo(() => getHonorificLabel(displayName), [displayName]);

  useEffect(() => {
    const onboardingDraft = loadOnboardingDraft();
    const localPreferences = loadPreferences();
    const nowIso = new Date().toISOString();
    const hydratedPreferences = {
      ...localPreferences,
      lastSeenAt: nowIso,
    };

    if (onboardingDraft.nickname.trim()) {
      setDisplayName(onboardingDraft.nickname.trim());
    }

    setPreviousSeenAt(localPreferences.lastSeenAt);
    setPreferences(hydratedPreferences);
    savePreferences(hydratedPreferences);

    if (typeof window !== 'undefined') {
      setWidgetDateLabel(
        new Intl.DateTimeFormat('ko-KR', {
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        }).format(new Date())
      );

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
        setPreviousSeenAt(nextPreferences.lastSeenAt);
        setPreferences(hydratedPreferences);
        savePreferences(hydratedPreferences);
      } catch {
        // 로컬 fallback 유지
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

  const notificationCards = useMemo(
    () =>
      NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => ({
        ...slot,
        enabled: preferences.enabled && preferences.slots[slot.key],
        preview: buildScheduleBody(slot.body, honorific),
      })),
    [honorific, preferences]
  );

  const nextUpcoming = enabledSlots[0]
    ? isHydrated
      ? computeUpcomingLabel(enabledSlots[0])
      : enabledSlots[0].timeLabel
    : '알림이 모두 꺼져 있습니다.';
  const retentionCopy = isHydrated ? formatVisitedDistance(previousSeenAt) : '방문 기록을 확인하고 있습니다.';
  const widgetBlueprint = HOME_WIDGET_BLUEPRINT.find(
    (item) => item.size === preferences.widgetSize
  );
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
        setStatusMessage(data?.error ?? '알림 설정을 서버에 저장하지 못했습니다.');
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
      setStatusMessage('이 브라우저에서는 웹 푸시를 지원하지 않습니다.');
      return;
    }

    if (!webPushPublicKey) {
      setStatusMessage('웹 푸시 공개키가 아직 설정되지 않았습니다.');
      return;
    }

    if (!isLoggedIn) {
      setStatusMessage('브라우저 푸시는 로그인 후 연결할 수 있습니다.');
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
        setStatusMessage(data?.error ?? '푸시 구독을 저장하지 못했습니다.');
        return;
      }

      setIsCurrentDeviceSubscribed(true);
      setStatusMessage('이 브라우저가 달빛인생 알림 기기로 연결되었습니다.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '브라우저 푸시 연결에 실패했습니다.'
      );
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
      setStatusMessage('이 브라우저의 푸시 연결을 해제했습니다.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : '브라우저 푸시 연결 해제에 실패했습니다.'
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

      setStatusMessage('테스트 알림을 보냈습니다. 브라우저 알림창을 확인해 주세요.');
    } catch {
      setStatusMessage('네트워크 오류로 테스트 알림을 보내지 못했습니다.');
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={
            <>
              <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]">
                알림 센터
              </Badge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                푸시 · 위젯 · 리텐션
              </Badge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                {isCurrentDeviceSubscribed ? '브라우저 연결됨' : '브라우저 미연결'}
              </Badge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                다음 예정 · {nextUpcoming}
              </Badge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                최근 방문 · {retentionCopy}
              </Badge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                권한 상태 · {permission}
              </Badge>
            </>
          }
          title={`${honorific}께 다시 말을 거는 모든 장치를 한곳에 모았습니다`}
          description="아침과 저녁 푸시, 주간 세운, 홈 위젯, 미접속 리마인더까지 한 흐름으로 관리합니다. 단순 공지판이 아니라 다시 열어보게 만드는 재방문 흐름입니다."
        />

        <nav className="app-subnav">
          <Link
            href="/notifications"
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors',
              mode === 'center'
                ? 'bg-[var(--app-gold)]/14 text-[var(--app-gold-text)]'
                : 'text-[var(--app-copy-muted)] hover:bg-[var(--app-surface-strong)] hover:text-[var(--app-ivory)]'
            )}
          >
            센터
          </Link>
          <Link
            href="/notifications/schedule"
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors',
              mode === 'schedule'
                ? 'bg-[var(--app-gold)]/14 text-[var(--app-gold-text)]'
                : 'text-[var(--app-copy-muted)] hover:bg-[var(--app-surface-strong)] hover:text-[var(--app-ivory)]'
            )}
          >
            푸시 스케줄
          </Link>
          <Link
            href="/notifications/widget"
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors',
              mode === 'widget'
                ? 'bg-[var(--app-gold)]/14 text-[var(--app-gold-text)]'
                : 'text-[var(--app-copy-muted)] hover:bg-[var(--app-surface-strong)] hover:text-[var(--app-ivory)]'
            )}
          >
            홈 위젯
          </Link>
        </nav>

        {statusMessage ? (
          <SectionSurface
            surface="muted"
            className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-sm leading-7 text-[var(--app-ivory)]"
          >
            {statusMessage}
          </SectionSurface>
        ) : null}

        {(mode === 'center' || mode === 'schedule') ? (
          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <SectionSurface surface="panel" size="lg">
              <SectionHeader
                eyebrow="오늘의 알림 보관함"
                title="언제 다시 말을 걸지, 여기서 조용히 고릅니다"
                description="주요 시간대별 메시지를 먼저 훑고, 필요한 시간만 켜 두는 방식으로 관리합니다."
                titleClassName="text-3xl"
              />
              <div className="mt-5 space-y-3">
                {notificationCards.map((slot) => (
                  <div
                    key={slot.key}
                    className={cn(
                      'rounded-[1.25rem] border px-4 py-4 transition-colors',
                      slot.enabled
                        ? 'border-[var(--app-line-strong)] bg-[var(--app-surface-strong)]'
                        : 'border-[var(--app-line)] bg-[var(--app-surface-muted)]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-[var(--app-ivory)]">
                          {slot.title}
                        </div>
                        <div className="mt-1 text-xs text-[var(--app-copy-soft)]">
                          {slot.cadence} · {slot.timeLabel}
                        </div>
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
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          slot.enabled
                            ? 'border-[var(--app-gold)]/30 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)]'
                            : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]'
                        )}
                      >
                        {slot.enabled ? '켜짐' : '꺼짐'}
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{slot.preview}</p>
                  </div>
                ))}
              </div>
            </SectionSurface>

            <SupportRail
              surface="panel"
              eyebrow="보조 설정"
              title="스타일, 기기 연결, 재방문 간격을 한 축에서 관리합니다"
              description="설정을 흩어 놓지 않고, 실제 알림 시간대 오른쪽에서 함께 조절할 수 있게 정리했습니다."
            >
              <FeatureCard
                surface="soft"
                eyebrow="알림 스타일"
                icon={<Clock3 className="h-5 w-5 text-[var(--app-gold)]" />}
              >
                <div className="grid gap-3">
                  {[
                    { value: 'quiet', label: '조용히' },
                    { value: 'normal', label: '보통' },
                    { value: 'sound', label: '소리' },
                  ].map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() =>
                        updatePreferences((current) => ({
                          ...current,
                          style: style.value as NotificationStyle,
                        }))
                      }
                      className={cn(
                        'rounded-[1.15rem] border px-4 py-4 text-left text-sm transition-colors',
                        preferences.style === style.value
                          ? 'border-[var(--app-gold)]/32 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]'
                          : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]'
                      )}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() =>
                    updatePreferences((current) => ({
                      ...current,
                      enabled: !current.enabled,
                    }))
                  }
                  className="mt-5 w-full"
                >
                  {preferences.enabled ? '알림 전체 끄기' : '알림 전체 켜기'}
                </Button>
              </FeatureCard>

              <FeatureCard
                className="mt-4"
                surface="soft"
                eyebrow="브라우저 푸시 연결"
                icon={<Send className="h-5 w-5 text-[var(--app-gold)]" />}
              >
                <div className="space-y-3 text-sm leading-7 text-[var(--app-copy)]">
                  <p>
                    {pushSupported
                      ? '이 브라우저에서 웹 푸시 자체는 지원합니다.'
                      : '이 브라우저 또는 현재 환경에서는 웹 푸시를 지원하지 않습니다.'}
                  </p>
                  <p>
                    {isLoggedIn
                      ? '로그인된 기기라면 연결 후 테스트 알림까지 바로 확인할 수 있습니다.'
                      : '실제 푸시 연결은 로그인 후 저장됩니다.'}
                  </p>
                  <div className="grid gap-2">
                    {[
                      { label: '브라우저 지원', ready: pushSupported },
                      { label: '공개키 설정', ready: Boolean(webPushPublicKey) },
                      { label: '로그인 상태', ready: isLoggedIn },
                      { label: '권한 허용', ready: permission === 'granted' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          'rounded-[1rem] border px-3 py-2 text-xs',
                          item.ready
                            ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-100'
                            : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-soft)]'
                        )}
                      >
                        {item.ready ? '준비됨' : '확인 필요'} · {item.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    onClick={isCurrentDeviceSubscribed ? disconnectPush : connectPush}
                    disabled={isConnectingPush || !pushReady}
                  >
                    {isConnectingPush
                      ? '연결 처리 중...'
                      : isCurrentDeviceSubscribed
                        ? '이 브라우저 연결 해제'
                        : '이 브라우저 알림 연결'}
                  </Button>
                  {!pushReady ? (
                    <p className="text-xs leading-6 text-[var(--app-copy-soft)]">
                      브라우저 지원과 공개키 설정이 모두 준비되어야 실제 푸시 연결 버튼이 열립니다.
                    </p>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={sendTestPush}
                    disabled={isSendingTest || !isCurrentDeviceSubscribed}
                  >
                    {isSendingTest ? '테스트 발송 중...' : '테스트 알림 보내기'}
                  </Button>
                </div>
              </FeatureCard>

              <FeatureCard
                className="mt-4"
                surface="soft"
                eyebrow="리텐션 상태"
                icon={<CalendarDays className="h-5 w-5 text-[var(--app-gold)]" />}
              >
                <div className="space-y-3 text-sm leading-7 text-[var(--app-copy)]">
                  <p>{retentionCopy}</p>
                  <p>
                    미접속 {preferences.inactivityReminderDays}일째가 되면 재방문 리마인더를
                    보냅니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[3, 5, 7].map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          updatePreferences((current) => ({
                            ...current,
                            inactivityReminderDays: day as 3 | 5 | 7,
                          }))
                        }
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          preferences.inactivityReminderDays === day
                            ? 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]'
                            : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]'
                        )}
                      >
                        {day}일
                      </button>
                    ))}
                  </div>
                </div>
              </FeatureCard>
            </SupportRail>
          </section>
        ) : null}

        {(mode === 'center' || mode === 'widget') ? (
          <section className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
            <SectionSurface surface="panel" size="lg">
              <SectionHeader
                eyebrow="홈 위젯 미리보기"
                title="무료 탐색 이후의 한 줄 요약이 어떻게 남는지 먼저 봅니다"
                description="오늘의 흐름, 최근 저장 결과, 요약 포인트가 어떤 비율로 보이는지 실제 미리보기 안에서 확인할 수 있습니다."
                titleClassName="text-3xl"
              />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.6rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
                  <div className="text-[10px] tracking-[0.2em] text-[var(--app-gold)]/70">
                    {widgetDateLabel}
                  </div>
                  <div className="mt-4 font-[var(--font-heading)] text-lg leading-7 text-[var(--app-ivory)]">
                    {snapshot.latestReading?.dailyLine ?? '오늘은 서두르지 않으시는 것이 가장 큰 지혜입니다'}
                  </div>
                  <div className="mt-4 flex gap-2 text-[11px]">
                    <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-strong)] px-3 py-1 text-[var(--app-copy)]">
                      {snapshot.latestReading?.luckyColor ?? '흰색'}
                    </span>
                    <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-strong)] px-3 py-1 text-[var(--app-copy)]">
                      {snapshot.latestReading?.luckyNumber ?? 7}
                    </span>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-[var(--app-gold)]/26 bg-[linear-gradient(135deg,rgba(10,18,36,0.98),rgba(22,26,46,0.94))] p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-[var(--font-heading)] text-sm tracking-[0.25em] text-[var(--app-gold)]/72">
                      月光先生
                    </div>
                    <div className="text-[11px] text-[var(--app-copy-soft)]">오늘의 리듬</div>
                  </div>
                  <div className="mt-4 font-[var(--font-heading)] text-lg leading-7 text-[var(--app-ivory)]">
                    {snapshot.latestReading?.dailyLine ?? '서두르지 않으시는 것이 가장 큰 지혜'}
                  </div>
                  <div className="mt-4 text-xs leading-6 text-[var(--app-copy-muted)]">
                    {snapshot.latestReading?.dayPillarLabel ?? '사주 저장 후 원국 요약 노출'} ·{' '}
                    {snapshot.latestReading?.dominantElement ?? '수'} 용신 포인트
                  </div>
                  <div className="mt-4 text-xs leading-6 text-[var(--app-copy-soft)]">
                    {snapshot.latestReading?.currentLuckSummary ??
                      '최근 저장한 결과가 생기면 현재 운 흐름도 여기서 함께 보여드립니다.'}
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() =>
                      updatePreferences((current) => ({
                        ...current,
                        widgetSize: size,
                      }))
                    }
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      preferences.widgetSize === size
                        ? 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]'
                        : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]'
                    )}
                  >
                    {size === 'small'
                      ? '작은 위젯'
                      : size === 'medium'
                        ? '중간 위젯'
                        : '큰 위젯'}
                  </button>
                ))}
              </div>
            </SectionSurface>

            <SupportRail
              surface="panel"
              eyebrow="보조 설명"
              title="위젯 문법과 저장 결과 연동을 따로 읽을 수 있게 둡니다"
              description="미리보기는 왼쪽에서 바로 보고, 설계 원칙과 최근 저장 결과 연결은 오른쪽에서 보조 정보로 읽는 구조입니다."
            >
              <FeatureCard
                surface="soft"
                eyebrow="위젯 설계"
                icon={<MoonStar className="h-5 w-5 text-[var(--app-gold)]" />}
              >
                {widgetBlueprint ? (
                  <>
                    <h3 className="text-2xl font-semibold text-[var(--app-ivory)]">
                      {widgetBlueprint.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
                      {widgetBlueprint.summary}
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-[var(--app-copy-muted)]">
                      {widgetBlueprint.details.map((item) => (
                        <div
                          key={item}
                          className="rounded-[1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </FeatureCard>

              <FeatureCard
                className="mt-4"
                surface="soft"
                eyebrow="최근 저장 결과 연동"
                icon={<Sparkles className="h-5 w-5 text-[var(--app-gold)]" />}
              >
                {snapshot.latestReading ? (
                  <>
                    <h3 className="text-2xl font-semibold text-[var(--app-ivory)]">
                      {snapshot.latestReading.dayPillarLabel}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
                      강한 오행은 {snapshot.latestReading.dominantElement}, 보완 포인트는{' '}
                      {snapshot.latestReading.weakestElement}입니다. 위젯에도 이 요약이 반영됩니다.
                    </p>
                    <Link
                      href={snapshot.latestReading.href}
                      className="moon-action-secondary mt-5"
                    >
                      최근 결과 다시 보기
                    </Link>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-[var(--app-copy)]">
                    첫 사주를 저장하면 위젯에 일주, 오행 균형, 현재 운 흐름이 함께 나타납니다.
                  </p>
                )}
              </FeatureCard>
            </SupportRail>
          </section>
        ) : null}

        {(mode === 'center' || mode === 'schedule') ? (
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="리텐션 설계 원칙"
              title="어떤 계기로 다시 열어보게 만드는지"
              description="시나리오별 재방문 목적을 짧게 비교해서, 알림이 단순 공지가 아니라 다시 읽게 만드는 연결 장치라는 점을 분명히 둡니다."
              titleClassName="text-3xl"
            />
            <ProductGrid columns={4} className="mt-5">
              {RETENTION_SCENARIOS.map((scenario) => (
                <FeatureCard
                  key={scenario.trigger}
                  surface="soft"
                  eyebrow={scenario.trigger}
                  description={
                    <>
                      <span className="block text-sm leading-7 text-[var(--app-copy)]">
                        {scenario.action}
                      </span>
                      <span className="mt-3 block text-xs leading-6 text-[var(--app-copy-soft)]">
                        {scenario.purpose}
                      </span>
                    </>
                  }
                />
              ))}
            </ProductGrid>
          </SectionSurface>
        ) : null}
      </AppPage>
    </AppShell>
  );
}
