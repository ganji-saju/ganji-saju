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
  Plus,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { LayoutModeControl } from '@/features/layout-preference/layout-mode-control';
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
  사주추가: { glyph: '+', accent: 'var(--app-pink)', description: '생년월일 입력' },
  무료운세: { glyph: '✨', accent: 'var(--app-pink-strong)', description: '오늘운·타로' },
  대화방: { glyph: '💬', accent: 'var(--app-pink)', description: '궁금한 것 묻기' },
  보관함: { glyph: '🔖', accent: 'var(--app-copy-muted)', description: '기록과 코인' },
  오늘운: { glyph: '🐮', accent: 'var(--app-pink)', description: '지금 바로 한 줄' },
  사주: { glyph: '🐲', accent: 'var(--app-pink)', description: '내 사주 풀이' },
  명리: { glyph: '🐯', accent: 'var(--app-pink-soft-strong)', description: '깊은 풀이' },
  타로: { glyph: '🐰', accent: 'var(--app-pink-strong)', description: '마음이 끌리는 카드' },
  궁합: { glyph: '🐑', accent: 'var(--app-pink)', description: '둘 사이 흐름' },
  별자리: { glyph: '✦', accent: 'var(--app-pink-soft-strong)', description: '이번 주 감정선' },
  띠운세: { glyph: '🐾', accent: 'var(--app-pink)', description: '내 띠 오늘 흐름' },
  안내: { glyph: '?', accent: 'var(--app-copy-muted)', description: '이용 안내' },
};

const MOBILE_SHORTCUT_LABEL_ORDER = ['오늘운', '타로', '사주', '궁합', '띠운세', '별자리'] as const;
const MOBILE_FEATURE_LABELS = new Set(['오늘운', '타로', '사주', '궁합']);
const MOBILE_DOCK_LABELS: Record<string, string> = {
  홈: '홈',
  사주추가: '사주추가',
  무료운세: '무료운세',
  대화방: '대화방',
  보관함: '보관함',
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
  // 2026-05-14: 일관된 5x5 사이즈, center(무료운세) 만 6x6 → CSS 가 흰색 + 글로우 처리.
  switch (label) {
    case '홈':
      return <MoonStar className="h-[20px] w-[20px]" strokeWidth={2} />;
    case '사주추가':
      return <Plus className="h-[20px] w-[20px]" strokeWidth={2.4} />;
    case '무료운세':
      return <Sparkles className="h-[22px] w-[22px]" strokeWidth={2} />;
    case '대화방':
      return <MessageCircleMore className="h-[20px] w-[20px]" strokeWidth={2} />;
    case '보관함':
      return <BookOpenText className="h-[20px] w-[20px]" strokeWidth={2} />;
    default:
      return <UserRound className="h-[20px] w-[20px]" strokeWidth={2} />;
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

function DesktopNavLink({
  item,
  pathname,
  compact = false,
}: {
  item: NavItem;
  pathname: string;
  compact?: boolean;
}) {
  const active = matchesPath(item, pathname);
  const meta = getNavMeta(item);

  return (
    <Link
      href={item.href}
      scroll={false}
      onClick={(event) => {
        if (active) event.preventDefault();
      }}
      data-active={active}
      className={cn(
        'app-nav-card flex items-center text-[var(--app-copy-muted)]',
        compact ? 'gap-2 px-2.5 py-1.5' : 'gap-2.5 px-3 py-2'
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl border bg-[var(--app-surface-muted)] font-semibold',
          compact ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'
        )}
        style={{
          borderColor: active ? meta.accent : 'var(--app-line)',
          color: meta.accent,
        }}
      >
        {meta.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--app-ivory)]">
          {item.label}
        </span>
        {!compact ? (
          <span className="mt-0.5 block truncate text-[11px] text-[var(--app-copy-soft)]">
            {meta.description}
          </span>
        ) : null}
      </span>
      {active ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: meta.accent }}
        />
      ) : null}
    </Link>
  );
}

function DesktopNavChip({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = matchesPath(item, pathname);
  const meta = getNavMeta(item);

  return (
    <Link
      href={item.href}
      scroll={false}
      onClick={(event) => {
        if (active) event.preventDefault();
      }}
      data-active={active}
      className="app-nav-card flex min-h-10 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-[var(--app-copy-muted)]"
    >
      <span
        className=" text-xs"
        style={{ color: meta.accent }}
      >
        {meta.glyph}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function DesktopSidebar({
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
  const displayName = user?.email?.split('@')[0] ?? '방문자';

  // PR #155 — PC 사이드바는 메가 메뉴로 대체. lg+ 에서 안 보이도록 'hidden' 만 적용.
  return (
    <aside className="app-desktop-sidebar hidden flex-col overflow-hidden">

      <div className="relative z-10 border-b border-[var(--app-line)] px-6 py-5">
        <Link href="/" className="group block">
          <div className=" text-[11px] tracking-[0.48em] text-[var(--app-gold)]/72">
            DALBIT LIFE
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="app-moon-orb h-10 w-10" />
            <div>
              <div className=" text-2xl font-medium tracking-tight text-[var(--app-gold-text)] transition-colors group-hover:text-[var(--app-ivory)]">
                달빛인생
              </div>
              <div className="text-xs text-[var(--app-copy-soft)]">오늘의 운세와 타로</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="relative z-10 border-b border-[var(--app-line)] px-5 py-3">
        <div className="rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--app-gold)]/35 bg-[var(--app-gold)]/16 text-lg text-[var(--app-gold-text)]">
              {user ? '👤' : '🌙'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--app-ivory)]">
                {displayName}님
              </div>
              <div className="mt-1 text-xs text-[var(--app-copy-soft)]">
                {user ? `${credits ?? '...'} 코인 보유` : '로그인하면 기록 저장'}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="gangi-secondary-button w-full"
              >
                <LogOut className="h-3.5 w-3.5" />
                로그아웃
              </button>
            ) : (
              <Link
                href={authHref}
                scroll={false}
                className="gangi-primary-button w-full"
              >
                로그인
              </Link>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/credits"
                scroll={false}
                className="gangi-secondary-button"
              >
                <CreditCard className="h-3.5 w-3.5" />
                코인 충전
              </Link>
              <Link
                href="/membership"
                scroll={false}
                className="gangi-secondary-button"
              >
                <Sparkles className="h-3.5 w-3.5" />
                프리미엄
              </Link>
            </div>
          </div>
        </div>
      </div>

      <nav className="relative z-10 flex-1 space-y-3 px-4 py-3">
        <div>
          <div className="app-caption px-2">주요 여정</div>
          <div className="mt-2 space-y-1.5">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <DesktopNavLink key={item.label} item={item} pathname={pathname} />
            ))}
          </div>
        </div>

        <div>
          <div className="app-caption px-2">서비스 메뉴</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {HEADER_SECONDARY_NAV_ITEMS.map((item) => (
              <DesktopNavChip key={item.label} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      </nav>

      <div className="relative z-10 border-t border-[var(--app-line)] px-5 py-3">
        <div className="app-caption mb-2">보기 방식</div>
        <LayoutModeControl />
        <div className="app-caption mb-2 mt-3">읽기 크기</div>
        <ReadingComfortControl />
      </div>
    </aside>
  );
}

// 2026-05-14: 햄버거 drawer 의 메뉴 그룹 헬퍼. 제목 + 항목 list rows.
function MenuGroup({
  title,
  items,
  pathname,
  onItemClick,
}: {
  title: string;
  items: ReadonlyArray<{ label: string; href: string; desc: string }>;
  pathname: string;
  onItemClick: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="app-mobile-menu-group-title">{title}</div>
      <div className="mt-2 grid gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={onItemClick}
              className="flex items-center gap-3 rounded-[12px] border px-3 py-2.5 transition-colors"
              style={{
                borderColor: active ? 'var(--app-pink-line)' : 'transparent',
                background: active ? 'var(--app-pink-soft)' : 'transparent',
              }}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
                style={{
                  background: active ? 'var(--app-pink)' : 'rgba(0,0,0,0.04)',
                  color: active ? '#fff' : 'var(--app-copy-muted)',
                }}
                aria-hidden="true"
              >
                ›
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[13.5px] font-extrabold"
                  style={{
                    color: active ? 'var(--app-pink-strong)' : 'var(--app-ink)',
                  }}
                >
                  {item.label}
                </span>
                <span className="block truncate text-[11px] text-[var(--app-copy-soft)]">
                  {item.desc}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
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
  const activePrimaryMeta = activePrimaryItem ? getNavMeta(activePrimaryItem) : null;
  const activeShortcutMeta = activeShortcutItem ? getNavMeta(activeShortcutItem) : null;
  const contextDescription =
    activeShortcutMeta?.description ??
    activePrimaryMeta?.description ??
    '오늘의 운세와 타로';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className="app-top-header sticky top-0 z-40 border-b bg-white/95 backdrop-blur"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="app-top-header-inner app-top-header-main px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            {/* §Brand — 2026-05-14 리디자인: 컨텍스트 설명 제거, 한 줄 lockup */}
            <Link href="/" className="app-top-brand min-w-0 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--app-pink) 0%, var(--app-pink-strong) 100%)',
                  fontFamily: 'var(--font-han)',
                  fontWeight: 800,
                  fontSize: 19,
                  letterSpacing: '-0.02em',
                  boxShadow: '0 6px 14px rgba(216,27,114,0.26)',
                }}
              >
                干
              </span>
              <div className="leading-none min-w-0">
                <div
                  className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--app-pink-strong)]"
                  style={{ marginBottom: 3 }}
                >
                  달빛인생
                </div>
                <div
                  className="text-[16.5px] font-extrabold tracking-tight text-[var(--app-ink)]"
                  style={{ fontFamily: 'var(--font-han)' }}
                >
                  간지사주
                </div>
              </div>
            </Link>

            {/* §Desktop primary nav — 라운드 underline 형 */}
            <nav
              className="app-top-primary-nav hidden min-w-0 items-center gap-0.5 md:flex"
              aria-label="주요 메뉴"
            >
              {PRIMARY_NAV_ITEMS.map((item) => {
                const active = matchesPath(item, pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    data-active={active}
                    scroll={false}
                    className="relative inline-flex shrink-0 items-center rounded-[10px] px-3 py-2 text-[13.5px] font-bold transition-colors"
                    style={{
                      color: active
                        ? 'var(--app-pink-strong)'
                        : 'var(--app-copy-muted)',
                      background: active ? 'var(--app-pink-soft)' : 'transparent',
                    }}
                  >
                    {getMobileDockLabel(item)}
                  </Link>
                );
              })}
            </nav>

            {/* §Actions — 2026-05-14 리디자인: 일관된 36px 원형/캡슐 버튼 */}
            <div className="app-top-actions flex items-center gap-1.5">
              {/* 코인 chip — desktop only, pink-soft */}
              <Link
                href="/credits"
                aria-label={`보유 코인 ${creditLabel(user, credits)}`}
                className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold md:inline-flex"
                style={{
                  background: 'var(--app-pink-soft)',
                  color: 'var(--app-pink-strong)',
                  border: '1px solid var(--app-pink-line)',
                }}
              >
                <span style={{ fontSize: 13 }} aria-hidden="true">✦</span>
                {creditLabel(user, credits)}
              </Link>

              {/* 2026-05-15 — 검색 진입점 헤더에 명시 추가. 사용자가 검색 페이지를 찾기 어려움. */}
              <Link
                href="/search"
                aria-label="검색"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-white text-[var(--app-ink)] transition-colors hover:bg-[var(--app-pink-soft)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </Link>

              {/* Bell — 36×36 outline circle */}
              <Link
                href="/notifications"
                aria-label="알림"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-white text-[var(--app-ink)] transition-colors hover:bg-[var(--app-pink-soft)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <Bell className="h-[18px] w-[18px]" />
              </Link>

              {/* 로그인/로그아웃 — desktop pill */}
              {user ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="hidden h-9 items-center rounded-full border bg-white px-3.5 text-[12.5px] font-extrabold text-[var(--app-copy-muted)] md:inline-flex"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  로그아웃
                </button>
              ) : (
                <Link
                  href={authHref}
                  className="hidden h-9 items-center rounded-full px-3.5 text-[12.5px] font-extrabold text-white md:inline-flex"
                  style={{
                    background: 'var(--app-pink)',
                    boxShadow: '0 6px 14px rgba(216,27,114,0.26)',
                  }}
                >
                  로그인
                </Link>
              )}

              {/* Hamburger — 36×36 outline circle (mobile only) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-global-menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-white text-[var(--app-ink)] transition-colors hover:bg-[var(--app-pink-soft)] md:hidden"
                style={{ borderColor: 'var(--app-line)' }}
                aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              >
                {mobileMenuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
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
                  <div className="app-mobile-menu-title">지금 볼 운세를 고르세요</div>
                  <div className="app-mobile-menu-subtitle">자주 쓰는 메뉴만 먼저 보여드려요.</div>
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

              {/* 2026-05-14: 전체 메뉴를 5개 섹션으로 정리.
                  자주 쓰는 4개 chip + 운세 / 사주풀이 / 관계상담 / 내 계정 / 안내. */}

              {/* §자주 쓰는 (4 chip) */}
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

              {/* §운세 — 무료/일상 운세 모음 */}
              <MenuGroup
                title="운세"
                items={[
                  { label: '오늘운세', href: '/today-fortune', desc: '오늘 한 줄' },
                  { label: '무료 운세 모음', href: '/free', desc: '오늘운/타로/띠' },
                  { label: '타로 한 장', href: '/tarot/daily', desc: '카드 한 장' },
                  { label: '띠운세', href: '/zodiac', desc: '12 띠별 흐름' },
                  { label: '별자리', href: '/star-sign', desc: '12 별자리' },
                  { label: '꿈해몽', href: '/dream', desc: '꿈 단어 사전' },
                  { label: '검색', href: '/search', desc: '메뉴·풀이 통합 검색' },
                ]}
                pathname={pathname}
                onItemClick={() => setMobileMenuOpen(false)}
              />

              {/* §사주풀이 */}
              <MenuGroup
                title="사주 풀이"
                items={[
                  { label: '사주 시작하기', href: '/saju/new', desc: '생년월일 입력' },
                  { label: '깊은 풀이 (49,000원)', href: '/saju', desc: '내 사주 종합 분석' },
                  { label: '명리 입문', href: '/myeongri', desc: '사주 기초 개념' },
                  { label: '십신·십성', href: '/myeongri/ten-gods', desc: '관계 신살 풀이' },
                  { label: '대운 흐름', href: '/daewoon', desc: '10년 큰 흐름' },
                  { label: '좋은 날 택일', href: '/taekil', desc: '중요한 일 잡기' },
                  { label: '풀이 방식', href: '/method', desc: '엔진 작동 원리' },
                  { label: '샘플 리포트', href: '/sample-report', desc: '미리보기' },
                ]}
                pathname={pathname}
                onItemClick={() => setMobileMenuOpen(false)}
              />

              {/* §관계·상담 */}
              <MenuGroup
                title="관계·상담"
                items={[
                  { label: '궁합 보기', href: '/compatibility', desc: '두 사람 흐름' },
                  { label: '대화방', href: '/dialogue', desc: '12간지 선생님' },
                  { label: '1:1 상담 예약', href: '/dialogue/appointment', desc: '30분 깊은 상담' },
                ]}
                pathname={pathname}
                onItemClick={() => setMobileMenuOpen(false)}
              />

              {/* §내 계정 */}
              <MenuGroup
                title="내 계정"
                items={[
                  { label: 'MY 홈', href: '/my', desc: '코인·보관·멤버십' },
                  { label: '가족 사주', href: '/my/profile', desc: '내·가족 정보' },
                  { label: '저장한 풀이', href: '/my/results', desc: '보관함' },
                  { label: '결제 내역', href: '/my/billing', desc: '구매 기록' },
                  { label: '멤버십', href: '/membership', desc: '월 4,900원~' },
                  { label: '가격 안내', href: '/pricing', desc: '전체 상품' },
                  { label: '코인 충전', href: '/credits', desc: '코인 잔액·구매' },
                  { label: '알림 센터', href: '/notifications', desc: '푸시·위젯' },
                  { label: '설정', href: '/my/settings', desc: '계정 관리' },
                ]}
                pathname={pathname}
                onItemClick={() => setMobileMenuOpen(false)}
              />

              {/* §안내 */}
              <MenuGroup
                title="안내"
                items={[
                  { label: '이용 가이드', href: '/guide', desc: '서비스 안내' },
                  { label: '엔진 소개', href: '/about-engine', desc: '간지사주 알고리즘' },
                  { label: '이용약관', href: '/terms', desc: '서비스 약관' },
                  { label: '개인정보처리방침', href: '/privacy', desc: '데이터 처리' },
                ]}
                pathname={pathname}
                onItemClick={() => setMobileMenuOpen(false)}
              />

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

      {/* 2026-05-14: 하단 dock 리디자인 — 중앙 FAB (무료운세) 형광 글로우 +
          나머지 아이콘 통일된 크기 + 활성 시 상단 핑크 점 인디케이터. */}
      <nav className="app-mobile-dock fixed inset-x-0 bottom-0 z-40 px-3 py-3 md:hidden" aria-label="주 메뉴">
        <div className="app-mobile-dock-inner mx-auto grid max-w-md grid-cols-5">
          {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
            const active = matchesPath(item, pathname);
            const isCenter = item.label === '무료운세';

            return (
              <Link
                key={item.label}
                href={item.href}
                data-active={active}
                data-center={isCenter ? 'true' : undefined}
                aria-current={active ? 'page' : undefined}
                className="app-mobile-dock-link flex flex-col items-center justify-center px-2 py-2 text-center"
              >
                {/* 활성 indicator dot (center 제외) */}
                {!isCenter && active ? (
                  <span className="app-mobile-dock-indicator" aria-hidden="true" />
                ) : null}
                <span className="app-mobile-dock-icon">
                  <DockIcon label={item.label} />
                </span>
                {/* center FAB 의 sparkle accent */}
                {isCenter ? (
                  <span className="app-mobile-dock-center-sparkle" aria-hidden="true">
                    <Sparkles className="h-2.5 w-2.5" />
                  </span>
                ) : null}
                <span className="app-mobile-dock-label mt-1 text-[11px] font-medium">
                  {getMobileDockLabel(item)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
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

      sendNotificationHeartbeat();
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
