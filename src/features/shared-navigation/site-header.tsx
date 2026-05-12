'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  Bell,
  BookOpenText,
  CreditCard,
  Heart,
  Menu,
  LogOut,
  MessageCircleMore,
  MoonStar,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { ReadingComfortControl } from '@/features/layout-preference/reading-comfort-control';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  HEADER_SECONDARY_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
  type NavItem,
} from '@/shared/config/site-navigation';

const NOTIFICATION_HEARTBEAT_KEY = 'moonlight:notification-heartbeat-sent-at';
const HEADER_CREDIT_CACHE_KEY = 'moonlight:header-credit-cache-v1';
const HEADER_CREDIT_REFRESH_MS = 45 * 1000;

interface HeaderCreditSnapshot {
  userId: string;
  credits: number;
  fetchedAt: number;
}

let cachedHeaderUser: User | null | undefined;
let cachedHeaderCredits: HeaderCreditSnapshot | null = null;
let creditRefreshPromise: Promise<HeaderCreditSnapshot | null> | null = null;
let creditRefreshUserId: string | null = null;
let creditCacheVersion = 0;

const NAV_META: Record<string, { glyph: string; accent: string; description: string }> = {
  홈: { glyph: '🌙', accent: 'var(--app-pink)', description: '오늘의 시작' },
  '내 풀이': { glyph: '四', accent: 'var(--app-pink)', description: '사주와 성향사주' },
  관계: { glyph: '合', accent: 'var(--app-pink-soft-strong)', description: '궁합과 성향궁합' },
  오늘: { glyph: '今', accent: 'var(--app-pink-strong)', description: '오늘의 결' },
  대화: { glyph: '💬', accent: 'var(--app-pink)', description: 'AI에게 이어 묻기' },
  성향사주: { glyph: '四×軸', accent: 'var(--app-pink)', description: '타고난 결과 선택 습관' },
  성향궁합: { glyph: '合×軸', accent: 'var(--app-pink-soft-strong)', description: '두 사람의 관계 결' },
  오늘운세: { glyph: '今', accent: 'var(--app-pink)', description: '지금 바로 한 줄' },
  타로: { glyph: '☽', accent: 'var(--app-pink-strong)', description: '마음이 끌리는 카드' },
  보관함: { glyph: '🔖', accent: 'var(--app-copy-muted)', description: '기록과 코인' },
  가격: { glyph: '₩', accent: 'var(--app-pink)', description: '무료와 깊이보기' },
  오늘운: { glyph: '🐮', accent: 'var(--app-pink)', description: '지금 바로 한 줄' },
  사주: { glyph: '🐲', accent: 'var(--app-pink)', description: '내 사주 풀이' },
  명리: { glyph: '🐯', accent: 'var(--app-pink-soft-strong)', description: '깊은 풀이' },
  궁합: { glyph: '🐑', accent: 'var(--app-pink)', description: '둘 사이 흐름' },
  별자리: { glyph: '✦', accent: 'var(--app-pink-soft-strong)', description: '이번 주 감정선' },
  띠운세: { glyph: '🐾', accent: 'var(--app-pink)', description: '내 띠 오늘 흐름' },
  안내: { glyph: '?', accent: 'var(--app-copy-muted)', description: '이용 안내' },
};

const MOBILE_SHORTCUT_LABEL_ORDER = ['성향사주', '성향궁합', '오늘운세', '타로', '보관함', '가격'] as const;
const MOBILE_FEATURE_LABELS = new Set(['성향사주', '성향궁합']);
const MOBILE_MORE_LABELS = new Set(['오늘운세', '타로', '보관함', '가격']);
const MOBILE_DOCK_LABELS: Record<string, string> = {
  홈: '홈',
  '내 풀이': '내풀이',
  관계: '관계',
  오늘: '오늘',
  대화: '대화',
};

function matchesPath(item: NavItem, pathname: string) {
  if (item.href === '/') return pathname === '/';
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;

  return (
    item.matchPrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ?? false
  );
}

function getNavMeta(item: NavItem) {
  return NAV_META[item.label] ?? {
    glyph: item.label.slice(0, 1),
    accent: 'var(--app-pink)',
    description: '달빛인생',
  };
}

function getMobileDockLabel(item: NavItem) {
  return MOBILE_DOCK_LABELS[item.label] ?? item.label;
}

function orderMobileShortcutItems(items: readonly NavItem[]) {
  return [
    ...MOBILE_SHORTCUT_LABEL_ORDER.map((label) => items.find((item) => item.label === label)).filter(
      (item): item is NavItem => Boolean(item)
    ),
    ...items.filter((item) => !MOBILE_SHORTCUT_LABEL_ORDER.includes(item.label as never)),
  ];
}

function findActiveItem(items: readonly NavItem[], pathname: string) {
  return items.find((item) => matchesPath(item, pathname)) ?? null;
}

function DockIcon({ label }: { label: string }) {
  switch (label) {
    case '홈':
      return <MoonStar className="h-4 w-4" />;
    case '내 풀이':
      return <BookOpenText className="h-4 w-4" />;
    case '관계':
      return <Heart className="h-4 w-4" />;
    case '오늘':
      return <Sparkles className="h-4 w-4" />;
    case '대화':
      return <MessageCircleMore className="h-4 w-4" />;
    default:
      return <BookOpenText className="h-4 w-4" />;
  }
}

function creditLabel(user: User | null, credits: number | null) {
  return user ? `${credits ?? '...'} 코인` : '코인';
}

function readStoredCreditSnapshot(userId: string) {
  try {
    const raw = window.sessionStorage.getItem(HEADER_CREDIT_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HeaderCreditSnapshot>;
    if (
      parsed.userId !== userId ||
      typeof parsed.credits !== 'number' ||
      typeof parsed.fetchedAt !== 'number'
    ) {
      return null;
    }

    cachedHeaderCredits = {
      userId,
      credits: parsed.credits,
      fetchedAt: parsed.fetchedAt,
    };
    return cachedHeaderCredits;
  } catch {
    return null;
  }
}

function getCachedCreditSnapshot(userId: string) {
  if (cachedHeaderCredits?.userId === userId) return cachedHeaderCredits;
  return readStoredCreditSnapshot(userId);
}

function saveCreditSnapshot(snapshot: HeaderCreditSnapshot) {
  cachedHeaderCredits = snapshot;

  try {
    window.sessionStorage.setItem(HEADER_CREDIT_CACHE_KEY, JSON.stringify(snapshot));
  } catch {}
}

function clearCreditSnapshot() {
  cachedHeaderCredits = null;
  creditCacheVersion += 1;

  try {
    window.sessionStorage.removeItem(HEADER_CREDIT_CACHE_KEY);
  } catch {}
}

function shouldRefreshCreditSnapshot(snapshot: HeaderCreditSnapshot | null) {
  return !snapshot || Date.now() - snapshot.fetchedAt > HEADER_CREDIT_REFRESH_MS;
}

function runWhenBrowserIdle(task: () => void) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(task, { timeout: 2500 });
    return;
  }

  window.setTimeout(task, 1200);
}

function refreshCreditSnapshot(userId: string, loadCredits: () => Promise<number>) {
  if (creditRefreshPromise && creditRefreshUserId === userId) return creditRefreshPromise;

  const refreshVersion = creditCacheVersion;

  creditRefreshUserId = userId;
  creditRefreshPromise = loadCredits()
    .then((credits) => {
      if (creditCacheVersion !== refreshVersion || cachedHeaderUser?.id !== userId) {
        return null;
      }

      const snapshot = { userId, credits, fetchedAt: Date.now() };
      saveCreditSnapshot(snapshot);
      return snapshot;
    })
    .catch(() => null)
    .finally(() => {
      if (creditRefreshUserId === userId) {
        creditRefreshPromise = null;
        creditRefreshUserId = null;
      }
    });

  return creditRefreshPromise;
}

function NavLinkGroup({
  items,
  pathname,
}: {
  items: readonly NavItem[];
  pathname: string;
}) {
  return (
    <>
      {items.map((item) => {
        const active = matchesPath(item, pathname);
        const meta = getNavMeta(item);

        return (
          <Link
            key={item.label}
            href={item.href}
            data-active={active}
            scroll={false}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-[var(--app-copy-muted)] transition-colors hover:bg-[var(--app-pink-soft)] hover:text-[var(--app-ink)]"
          >
            <span aria-hidden="true" style={{ color: meta.accent }}>
              {meta.glyph}
            </span>
            <span>{getMobileDockLabel(item)}</span>
          </Link>
        );
      })}
    </>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="app-mobile-dock fixed inset-x-0 bottom-0 z-40 px-3 py-3 md:hidden" aria-label="주 메뉴">
      <div className="app-mobile-dock-inner mx-auto grid max-w-md grid-cols-5">
        {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
          const active = matchesPath(item, pathname);
          const isCenter = item.label === '오늘';

          return (
            <Link
              key={item.label}
              href={item.href}
              data-active={active}
              data-center={isCenter ? 'true' : undefined}
              aria-current={active ? 'page' : undefined}
              className="app-mobile-dock-link flex flex-col items-center justify-center px-2 py-2 text-center"
            >
              <span className="app-mobile-dock-icon">
                <DockIcon label={item.label} />
              </span>
              <span className="app-mobile-dock-label mt-1 text-[11px] font-medium">
                {getMobileDockLabel(item)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileChrome({
  pathname,
  user,
  credits,
  authHref,
  onSignOut,
}: {
  pathname: string;
  user: User | null;
  credits: number | null;
  authHref: string;
  onSignOut: () => Promise<void>;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activePrimaryItem = findActiveItem(PRIMARY_NAV_ITEMS, pathname);
  const activeShortcutItem = findActiveItem(HEADER_SECONDARY_NAV_ITEMS, pathname);
  const orderedShortcutItems = orderMobileShortcutItems(HEADER_SECONDARY_NAV_ITEMS);
  const featureShortcutItems = orderedShortcutItems.filter((item) =>
    MOBILE_FEATURE_LABELS.has(item.label)
  );
  const moreShortcutItems = orderedShortcutItems.filter((item) =>
    MOBILE_MORE_LABELS.has(item.label)
  );
  const activePrimaryMeta = activePrimaryItem ? getNavMeta(activePrimaryItem) : null;
  const activeShortcutMeta = activeShortcutItem ? getNavMeta(activeShortcutItem) : null;
  const contextDescription =
    activeShortcutMeta?.description ??
    activePrimaryMeta?.description ??
    '오늘의 결';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="app-top-header sticky top-0 z-40 border-b border-[var(--app-line)] bg-white/95 backdrop-blur">
        <div className="app-top-header-inner app-top-header-main px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="app-top-brand min-w-0">
              <div className="app-brand-lockup">
                <div className="app-brand-mini-logo">
                  <span>달</span>
                  <strong>빛</strong>
                </div>
                <div className="min-w-0">
                  <div className="app-top-brand-title truncate">
                    달빛인생
                  </div>
                  <div className="app-top-context-note truncate">
                    {contextDescription}
                  </div>
                </div>
              </div>
            </Link>

            <nav className="app-top-primary-nav hidden min-w-0 items-center gap-1 md:flex" aria-label="주요 메뉴">
              <NavLinkGroup items={PRIMARY_NAV_ITEMS} pathname={pathname} />
            </nav>

            <div className="app-top-actions flex items-center gap-2">
              <Link
                href="/credits"
                className="app-top-credit-chip inline-flex"
                aria-label={`보유 코인 ${creditLabel(user, credits)}`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                {creditLabel(user, credits)}
              </Link>
              <Link href="/notifications" className="app-top-notification-button hidden md:inline-flex" aria-label="알림">
                <Bell className="h-5 w-5" />
              </Link>
              {user ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="app-top-login inline-flex"
                >
                  로그아웃
                </button>
              ) : (
                <Link href={authHref} className="app-top-login inline-flex">
                  로그인
                </Link>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-global-menu"
                className="app-mobile-menu-trigger inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 text-[var(--app-ivory)] transition-colors hover:bg-[var(--app-surface-strong)] md:hidden"
                aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen ? (
            <div
              id="mobile-global-menu"
              className="app-mobile-menu-panel mt-4 rounded-[1.4rem] border border-[var(--app-line)] bg-white p-4 shadow-[0_18px_48px_rgba(17,17,20,0.12)]"
            >
              <div className="app-mobile-menu-head">
                <div className="min-w-0">
                  <div className="app-mobile-menu-eyebrow">전체 메뉴</div>
                  <div className="app-mobile-menu-title">오늘 볼 결을 고르세요</div>
                  <div className="app-mobile-menu-subtitle">내 풀이, 관계, 오늘 흐름을 빠르게 이어갑니다.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="app-mobile-menu-close"
                  aria-label="메뉴 닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {featureShortcutItems.map((item) => {
                  const active = matchesPath(item, pathname);
                  const meta = getNavMeta(item);

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'app-mobile-feature-card',
                        active && 'app-mobile-feature-card-active'
                      )}
                    >
                      <span
                        className="app-mobile-feature-glyph"
                        style={{ backgroundColor: meta.accent }}
                      >
                        {meta.glyph}
                      </span>
                      <span className="app-mobile-feature-copy">
                        <strong>{item.label}</strong>
                        <em>{meta.description}</em>
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-4">
                <div className="app-mobile-menu-group-title">빠른 바로가기</div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {moreShortcutItems.map((item) => {
                    const active = matchesPath(item, pathname);
                    const meta = getNavMeta(item);

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'app-mobile-shortcut-card',
                          active && 'app-mobile-shortcut-card-active'
                        )}
                      >
                        <span
                          className="app-mobile-shortcut-glyph"
                          style={{ color: meta.accent }}
                        >
                          {meta.glyph}
                        </span>
                        <span className="app-mobile-shortcut-label">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/my"
                  onClick={() => setMobileMenuOpen(false)}
                  className="app-mobile-menu-utility"
                >
                  <BookOpenText className="h-4 w-4" />
                  <span>보관함</span>
                </Link>
                <Link
                  href="/credits"
                  onClick={() => setMobileMenuOpen(false)}
                  className="app-mobile-menu-utility"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>코인</span>
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="app-mobile-menu-utility"
                >
                  <Bell className="h-4 w-4" />
                  <span>알림</span>
                </Link>
                <Link
                  href="/my/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="app-mobile-menu-utility"
                >
                  <Settings2 className="h-4 w-4" />
                  <span>설정</span>
                </Link>
              </div>

              <div className="mt-4">
                <div className="app-mobile-menu-group-title mb-2">읽기 크기</div>
                <ReadingComfortControl />
              </div>

              <div className="mt-4">
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void onSignOut();
                    }}
                    className="app-mobile-menu-auth"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>로그아웃</span>
                  </button>
                ) : (
                  <Link
                    href={authHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'app-mobile-menu-auth justify-center border-[var(--app-line)] bg-[var(--app-surface-strong)] text-[var(--app-ivory)] hover:bg-[var(--app-surface)] hover:text-[var(--app-ivory)]'
                    )}
                  >
                    로그인
                  </Link>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="app-top-header-shortcuts hidden border-t border-[var(--app-line)] bg-[var(--app-surface-muted)]">
          <div className="app-top-category-inner mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-8 py-3">
            {HEADER_SECONDARY_NAV_ITEMS.map((item) => {
              const active = matchesPath(item, pathname);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  data-active={active}
                  className={cn(
                    'app-top-category-chip shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-[var(--app-gold)]/40 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)]'
                      : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)] hover:border-[var(--app-line-strong)] hover:bg-[var(--app-surface-strong)] hover:text-[var(--app-ivory)]'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <MobileBottomNav pathname={pathname} />
    </>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(cachedHeaderUser ?? null);
  const [credits, setCredits] = useState<number | null>(cachedHeaderCredits?.credits ?? null);

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) {
      cachedHeaderUser = null;
      setUser(null);
      setCredits(null);
      return;
    }

    let isActive = true;
    const supabase = createClient();

    const sendNotificationHeartbeat = () => {
      try {
        const previous = window.localStorage.getItem(NOTIFICATION_HEARTBEAT_KEY);
        const shouldSendHeartbeat =
          !previous ||
          Date.now() - new Date(previous).getTime() > 6 * 60 * 60 * 1000;

        if (!shouldSendHeartbeat) return;

        void fetch('/api/notifications/heartbeat', {
          method: 'POST',
        })
          .then(() => {
            window.localStorage.setItem(
              NOTIFICATION_HEARTBEAT_KEY,
              new Date().toISOString()
            );
          })
          .catch(() => undefined);
      } catch {}
    };

    const refreshCreditsForUser = (nextUser: User) => {
      const cachedCredits = getCachedCreditSnapshot(nextUser.id);
      if (cachedCredits) {
        setCredits(cachedCredits.credits);
      } else if (cachedHeaderCredits?.userId !== nextUser.id) {
        setCredits(null);
      }

      if (!shouldRefreshCreditSnapshot(cachedCredits)) return;

      void refreshCreditSnapshot(nextUser.id, async () => {
        const { data: creditRow } = await supabase
          .from('user_credits')
          .select('balance, subscription_balance')
          .eq('user_id', nextUser.id)
          .maybeSingle();

        return (creditRow?.balance ?? 0) + (creditRow?.subscription_balance ?? 0);
      }).then((snapshot) => {
        if (isActive && snapshot?.userId === nextUser.id) {
          setCredits(snapshot.credits);
        }
      });
    };

    const applyHeaderUser = (nextUser: User | null) => {
      if (!isActive) return;

      cachedHeaderUser = nextUser;
      setUser(nextUser);

      if (!nextUser) {
        clearCreditSnapshot();
        setCredits(null);
        return;
      }

      runWhenBrowserIdle(() => {
        if (isActive) sendNotificationHeartbeat();
      });
      refreshCreditsForUser(nextUser);
    };

    const syncHeaderUser = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      applyHeaderUser(sessionUser ?? (await getCurrentBrowserUser(supabase)));
    };

    void syncHeaderUser().catch(() => {
      if (!isActive) return;
      applyHeaderUser(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;

      applyHeaderUser(session?.user ?? null);

      if (
        _event === 'SIGNED_IN' ||
        _event === 'SIGNED_OUT' ||
        _event === 'TOKEN_REFRESHED' ||
        _event === 'USER_UPDATED'
      ) {
        router.refresh();
      }
    });

    const syncCreditsFromEvent = (event: Event) => {
      if (!isActive || !cachedHeaderUser) return;

      const detail = (event as CustomEvent<{ credits?: number; remaining?: number }>).detail;
      const nextCredits =
        typeof detail?.credits === 'number'
          ? detail.credits
          : typeof detail?.remaining === 'number'
            ? detail.remaining
            : null;

      if (nextCredits === null) return;

      saveCreditSnapshot({
        userId: cachedHeaderUser.id,
        credits: nextCredits,
        fetchedAt: Date.now(),
      });
      setCredits(nextCredits);
    };

    const syncHeaderUserFromFocus = () => {
      void syncHeaderUser().catch(() => undefined);
    };

    const syncHeaderUserFromVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void syncHeaderUser().catch(() => undefined);
    };

    window.addEventListener('moonlight:credits-updated', syncCreditsFromEvent);
    window.addEventListener('focus', syncHeaderUserFromFocus);
    document.addEventListener('visibilitychange', syncHeaderUserFromVisibility);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener('moonlight:credits-updated', syncCreditsFromEvent);
      window.removeEventListener('focus', syncHeaderUserFromFocus);
      document.removeEventListener('visibilitychange', syncHeaderUserFromVisibility);
    };
  }, [router]);

  async function signOut() {
    if (!hasSupabaseBrowserEnv) {
      router.push('/');
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    cachedHeaderUser = null;
    clearCreditSnapshot();
    setUser(null);
    setCredits(null);
    router.push('/');
    router.refresh();
  }

  const authHref = `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <>
      <MobileChrome
        pathname={pathname}
        user={user}
        credits={credits}
        authHref={authHref}
        onSignOut={signOut}
      />
    </>
  );
}
