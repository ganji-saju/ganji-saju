'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
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
  hasSupabaseBrowserEnv,
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
  'today-star-sign': {
    href: '/star-sign',
    desc: '내 별자리 오늘 점수와 한 줄',
    label: '별자리 보기',
  },
  'subscription-expiring': {
    href: '/membership/checkout?plan=plus&from=expiring',
    desc: '멤버십 만료 임박 — 지금 연장하기',
    label: '연장하기',
  },
  'comeback-reminder': {
    href: '/star-sign',
    desc: '오랜만에 들어오시면 오늘 흐름 한 줄로',
    label: '돌아보기',
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
  } else if (slot.key === 'today-star-sign') {
    next.setHours(9, 0, 0, 0);
  } else if (slot.key === 'subscription-expiring') {
    next.setHours(10, 0, 0, 0);
  } else if (slot.key === 'today-tarot') {
    next.setHours(12, 0, 0, 0);
  } else if (slot.key === 'comeback-reminder') {
    next.setHours(19, 0, 0, 0);
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
  headerSlot,
}: {
  mode: NotificationPageMode;
  snapshot: NotificationSnapshot;
  /** 페이지 헤더 아래 (탭 위) 에 노출되는 server-render 슬롯. */
  headerSlot?: import('react').ReactNode;
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

  // Redesign 2026-05-13 (Claude Design / screens-d.jsx ScreenNotifications):
  // 2 탭 (받은 알림 feed / 알림 설정 set). PR6+ 디자인 언어 일관.
  const [tab, setTab] = useState<'feed' | 'set'>('feed');

  // §feed — notification_delivery_logs 기반 실데이터. snapshot.feed 가 server-side 에서 채워짐.
  type FeedItem = {
    id?: string;
    title: string;
    desc: string;
    time: string;
    zodiac?: ZodiacKey;
    icon?: string;
    isNew?: boolean;
    href?: string;
  };

  function formatLogTime(iso: string, todayStart: number, yesterdayStart: number) {
    const date = new Date(iso);
    const ms = date.getTime();
    if (ms >= todayStart || ms >= yesterdayStart) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const period = hours < 12 ? '오전' : '오후';
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      return `${period} ${displayHour}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function slotToZodiac(slotKey: string): ZodiacKey | undefined {
    if (slotKey.startsWith('today-fortune')) return 'rooster';
    if (slotKey.startsWith('today-tarot')) return 'rabbit';
    if (slotKey.startsWith('today-zodiac')) return 'horse';
    if (slotKey.startsWith('dialogue')) return 'snake';
    if (slotKey.startsWith('weekly') || slotKey.startsWith('monthly')) return 'tiger';
    if (slotKey.startsWith('seasonal')) return 'dragon';
    if (slotKey.startsWith('birthday') || slotKey.startsWith('returning')) return 'rat';
    return undefined;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  const feedToday: FeedItem[] = [];
  const feedYesterday: FeedItem[] = [];
  const feedWeek: FeedItem[] = [];

  for (const log of snapshot.feed ?? []) {
    const ms = new Date(log.createdAt).getTime();
    const item: FeedItem = {
      id: log.id,
      title: log.title,
      desc: log.body,
      time: formatLogTime(log.createdAt, todayStart, yesterdayStart),
      zodiac: slotToZodiac(log.slotKey),
      href: log.href,
      isNew: ms >= todayStart,
    };
    if (ms >= todayStart) feedToday.push(item);
    else if (ms >= yesterdayStart) feedYesterday.push(item);
    else if (ms >= weekStart) feedWeek.push(item);
  }

  // 첫 사용 — 발송 로그가 없으면 latestReading 으로 placeholder 한 줄.
  if (snapshot.feed && snapshot.feed.length === 0 && snapshot.latestReading) {
    feedToday.push({
      title: '오늘운세가 도착했어요',
      desc: snapshot.latestReading.dailyLine,
      time: '오전 7:00',
      zodiac: 'rooster',
      isNew: true,
      href: '/today-fortune',
    });
  }

  function FeedRow({ item }: { item: FeedItem }) {
    return (
      <Link
        href={item.href ?? '/notifications'}
        className="relative flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
      >
        {item.zodiac ? (
          <ZodiacChip kind={item.zodiac} size="sm" />
        ) : (
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[16px] font-extrabold"
            style={{
              background: 'var(--app-pink-soft)',
              color: 'var(--app-pink-strong)',
            }}
            aria-hidden="true"
          >
            {item.icon ?? '✦'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[13.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
              {item.title}
            </div>
            <div className="shrink-0 text-[10.5px] text-[var(--app-copy-soft)]">
              {item.time}
            </div>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-[var(--app-copy-soft)]">
            {item.desc}
          </div>
        </div>
        {item.isNew ? (
          <span
            className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--app-pink)' }}
            aria-hidden="true"
          />
        ) : null}
      </Link>
    );
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="알림" backHref="/" />

        {/* PR #133 — server-render 헤더 슬롯 (별자리 일진 카드 등). */}
        {headerSlot}

        {/* Tabs */}
        <div className="-mx-1 flex border-b border-[var(--app-line)]">
          {(
            [
              { key: 'feed' as const, label: '받은 알림' },
              { key: 'set' as const, label: '알림 설정' },
            ]
          ).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 border-b-2 px-2 py-3 text-[13.5px] transition',
                  active
                    ? 'border-[var(--app-pink)] font-extrabold text-[var(--app-pink-strong)]'
                    : 'border-transparent font-medium text-[var(--app-copy-soft)]'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'feed' ? (
          <section className="space-y-4 px-1">
            {/* PIN — 오늘 데일리 */}
            {snapshot.latestReading ? (
              <article
                className="rounded-[18px] border p-5"
                style={{
                  background: 'var(--app-pink-soft)',
                  borderColor: 'var(--app-pink-line)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-[6px] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-white"
                    style={{ background: 'var(--app-pink-strong)' }}
                  >
                    PIN
                  </span>
                  <span className="text-[11px] font-extrabold text-[var(--app-pink-strong)]">
                    오늘 아침 데일리
                  </span>
                </div>
                <h2 className="mt-2 text-[16px] font-extrabold leading-[1.45] tracking-tight text-[var(--app-ink)]">
                  {snapshot.latestReading.dailyLine}
                </h2>
                <Link
                  href={snapshot.latestReading.href}
                  className="mt-3 inline-flex text-[12px] font-extrabold text-[var(--app-pink-strong)]"
                >
                  오늘운세 자세히 →
                </Link>
              </article>
            ) : null}

            {/* Time groups */}
            {[
              { heading: '오늘', list: feedToday },
              { heading: '어제', list: feedYesterday },
              { heading: '이번 주', list: feedWeek },
            ].map((group) =>
              group.list.length > 0 ? (
                <section key={group.heading}>
                  <div className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                    {group.heading}
                  </div>
                  <div className="mt-2 grid gap-2.5">
                    {group.list.map((item, index) => (
                      <FeedRow key={`${group.heading}-${index}`} item={item} />
                    ))}
                  </div>
                </section>
              ) : null
            )}
          </section>
        ) : (
          <section className="space-y-5 px-1">
            {/* §1 알림 시간 */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                알림 시간
              </div>
              <h2 className="mt-1 text-[17px] font-extrabold leading-snug text-[var(--app-ink)]">
                매일 오전 7:00 받기
              </h2>
            </div>

            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="text-[13px] font-extrabold text-[var(--app-ink)]">
                알림 받을 시간
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {['오전 6시', '오전 7시', '오전 8시', '오전 9시', '오후 12시', '오후 6시', '오후 9시'].map(
                  (time, i) => {
                    const active = i === 1; // 오전 7시 기본
                    return (
                      <span
                        key={time}
                        className="rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition"
                        style={
                          active
                            ? {
                                background: 'var(--app-pink)',
                                color: '#fff',
                                borderColor: 'transparent',
                              }
                            : {
                                background: '#fff',
                                color: 'var(--app-copy-muted)',
                                borderColor: 'var(--app-line)',
                              }
                        }
                      >
                        {time}
                      </span>
                    );
                  }
                )}
              </div>
            </article>

            {/* §2 알림 종류 - 슬롯 토글 */}
            <section>
              <h2 className="px-1 text-[15px] font-extrabold text-[var(--app-ink)]">알림 종류</h2>
              <p className="px-1 mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
                {honorific}께 필요한 알림만 남겼습니다.
              </p>
              <article className="mt-3 overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white">
                {NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot, index) => {
                  const route = notificationRoutes[slot.key];
                  const enabled = preferences.enabled && preferences.slots[slot.key];
                  return (
                    <div
                      key={slot.key}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3.5',
                        index < NOTIFICATION_SCHEDULE_BLUEPRINT.length - 1 &&
                          'border-b border-[var(--app-line)]'
                      )}
                    >
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] text-[14px] font-extrabold"
                        style={
                          enabled
                            ? {
                                background: 'var(--app-pink-soft)',
                                color: 'var(--app-pink-strong)',
                              }
                            : {
                                background: 'rgba(0,0,0,0.04)',
                                color: 'var(--app-copy-soft)',
                              }
                        }
                        aria-hidden="true"
                      >
                        ✦
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                          {slot.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                          {route.desc} · {slot.timeLabel}
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
                        aria-pressed={enabled}
                        className="relative h-[26px] w-11 shrink-0 rounded-full transition"
                        style={{
                          background: enabled ? 'var(--app-pink)' : 'var(--app-line)',
                        }}
                      >
                        <span
                          className="absolute top-[3px] block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] duration-150"
                          style={{ left: enabled ? 21 : 3 }}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  );
                })}
              </article>
            </section>

            {/* §3 채널 */}
            <section>
              <h2 className="px-1 text-[15px] font-extrabold text-[var(--app-ink)]">채널</h2>
              <article className="mt-3 overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white">
                <div
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--app-line)]"
                >
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[var(--app-pink-soft)] text-[16px]"
                    aria-hidden="true"
                  >
                    📱
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                      앱 푸시 알림
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                      {isCurrentDeviceSubscribed
                        ? '이 브라우저에서 알림을 받고 있어요'
                        : pushSupported
                          ? '버튼을 눌러 이 브라우저에 연결하세요'
                          : '이 브라우저는 푸시 알림을 지원하지 않아요'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={isCurrentDeviceSubscribed ? disconnectPush : connectPush}
                    disabled={isConnectingPush || !pushReady}
                    className="rounded-full px-3 py-1.5 text-[11px] font-extrabold transition disabled:opacity-50"
                    style={
                      isCurrentDeviceSubscribed
                        ? {
                            background: 'var(--app-pink-soft)',
                            color: 'var(--app-pink-strong)',
                          }
                        : {
                            background: '#fff',
                            color: 'var(--app-copy-muted)',
                            border: '1px solid var(--app-line)',
                          }
                    }
                  >
                    {isConnectingPush
                      ? '처리 중'
                      : isCurrentDeviceSubscribed
                        ? '연결됨'
                        : '연결'}
                  </button>
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--app-line)]">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[var(--app-pink-soft)] text-[16px]"
                    aria-hidden="true"
                  >
                    💬
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                      카카오톡 알림톡
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                      준비 중
                    </div>
                  </div>
                  <span
                    className="rounded-full border border-[var(--app-line)] px-3 py-1 text-[11px] font-bold text-[var(--app-copy-soft)]"
                  >
                    준비 중
                  </span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[var(--app-pink-soft)] text-[16px]"
                    aria-hidden="true"
                  >
                    ✉
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">이메일</div>
                    <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                      등록한 이메일로 받기 · 준비 중
                    </div>
                  </div>
                  <span
                    className="rounded-full border border-[var(--app-line)] px-3 py-1 text-[11px] font-bold text-[var(--app-copy-soft)]"
                  >
                    준비 중
                  </span>
                </div>
              </article>

              {/* 테스트 발송 */}
              {isCurrentDeviceSubscribed ? (
                <button
                  type="button"
                  onClick={sendTestPush}
                  disabled={isSendingTest}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white text-[12.5px] font-bold text-[var(--app-copy-muted)] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSendingTest ? '발송 중...' : '테스트 알림 보내기'}
                </button>
              ) : null}
            </section>

            {/* 전체 토글 */}
            <button
              type="button"
              onClick={() =>
                updatePreferences((current) => ({
                  ...current,
                  enabled: !current.enabled,
                }))
              }
              className="inline-flex h-12 w-full items-center justify-center rounded-full text-[14px] font-extrabold transition"
              style={
                preferences.enabled
                  ? {
                      background: '#fff',
                      color: 'var(--app-coral)',
                      border: '1.5px solid var(--app-coral)',
                    }
                  : {
                      background: 'var(--app-pink)',
                      color: '#fff',
                      boxShadow: '0 12px 28px rgba(216,27,114,0.32)',
                    }
              }
            >
              {preferences.enabled ? '모든 알림 끄기' : '모든 알림 켜기'}
            </button>
          </section>
        )}

        {statusMessage ? (
          <p
            className="rounded-[12px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--app-ink)]"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            {statusMessage}
          </p>
        ) : null}
      </AppPage>
    </AppShell>
  );
}
