'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  Bell,
  BookOpenText,
  CreditCard,
  Menu,
  LogOut,
  MessageCircleMore,
  MoonStar,
  Plus,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { LayoutModeControl } from '@/features/layout-preference/layout-mode-control';
import { ReadingComfortControl } from '@/features/layout-preference/reading-comfort-control';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
// PR #156 — 모바일 메뉴 시트.
import { MobileNavSheet } from './mobile-nav-sheet';
import { resolveActiveGroup } from './mega-nav-data';
import { cn } from '@/lib/utils';
import { isFocusedCheckoutRoute } from '@/shared/layout/focused-checkout';
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
  보관함: { glyph: '🔖', accent: 'var(--app-copy-muted)', description: '기록과 전' },
  오늘운: { glyph: '🐮', accent: 'var(--app-pink)', description: '지금 바로 한 줄' },
  사주: { glyph: '🐲', accent: 'var(--app-pink)', description: '내 사주 풀이' },
  명리: { glyph: '🐯', accent: 'var(--app-pink-soft-strong)', description: '깊은 풀이' },
  타로: { glyph: '🐰', accent: 'var(--app-pink-strong)', description: '마음이 끌리는 카드' },
  궁합: { glyph: '🐑', accent: 'var(--app-pink)', description: '둘 사이 흐름' },
  별자리: { glyph: '✦', accent: 'var(--app-pink-soft-strong)', description: '이번 주 감정선' },
  띠운세: { glyph: '🐾', accent: 'var(--app-pink)', description: '내 띠 오늘 흐름' },
  안내: { glyph: '?', accent: 'var(--app-copy-muted)', description: '이용 안내' },
};

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
    description: '간지사주',
  };
}

function getMobileDockLabel(item: NavItem) {
  return MOBILE_DOCK_LABELS[item.label] ?? item.label;
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
  return user ? `${credits ?? '...'} 전` : '전';
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
    // 2026-05-16 — `scroll={false}` 는 새 페이지 진입 시 이전 스크롤 위치를 유지함.
    //   짧은 페이지로 이동할 때 "푸터로 화면이 점프했다가 전환" 회귀를 만들어 제거.
    //   nav 클릭 시 기본 동작(새 페이지 상단으로 이동) 이 자연스러움.
    <Link
      href={item.href}
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
          compact ? 'h-7 w-7 text-sm' : 'h-8 w-8 text-base'
        )}
        style={{
          borderColor: active ? meta.accent : 'var(--app-line)',
          color: meta.accent,
        }}
      >
        {meta.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-[var(--app-ivory)]">
          {item.label}
        </span>
        {!compact ? (
          <span className="mt-0.5 block truncate text-[12.6px] text-[var(--app-copy-soft)]">
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
    // 2026-05-16 — scroll={false} 제거 (push 스크롤 점프 회귀 fix).
    <Link
      href={item.href}
      onClick={(event) => {
        if (active) event.preventDefault();
      }}
      data-active={active}
      className="app-nav-card flex min-h-10 items-center justify-center gap-1.5 px-2 py-2 text-sm font-medium text-[var(--app-copy-muted)]"
    >
      <span
        className=" text-sm"
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
          <div className=" text-[12.6px] tracking-[0.48em] text-[var(--app-gold)]/72">
            DALBIT LIFE
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="app-moon-orb h-10 w-10" />
            <div>
              <div className=" text-3xl font-medium tracking-tight text-[var(--app-gold-text)] transition-colors group-hover:text-[var(--app-ivory)]">
                간지사주
              </div>
              <div className="text-sm text-[var(--app-copy-soft)]">오늘의 운세와 타로</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="relative z-10 border-b border-[var(--app-line)] px-5 py-3">
        <div className="rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--app-gold)]/35 bg-[var(--app-gold)]/16 text-xl text-[var(--app-gold-text)]">
              {user ? '👤' : '🌙'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-medium text-[var(--app-ivory)]">
                {displayName}님
              </div>
              <div className="mt-1 text-sm text-[var(--app-copy-soft)]">
                {user ? `${credits ?? '...'} 전 보유` : '로그인하면 기록 저장'}
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
                className="gangi-primary-button w-full"
              >
                로그인
              </Link>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/credits"
                className="gangi-secondary-button"
              >
                <CreditCard className="h-3.5 w-3.5" />
                전 잔액
              </Link>
              <Link
                href="/membership"
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

// 2026-05-20 — 무료운세 dock FAB 클릭 시 부채꼴로 펼쳐지는 5 메뉴.
//   각도 -170° ~ -10° 사이 균등 분포 (5개 항목, 위쪽 반원).
//   반경 105px (FAB center 원칙).
const FAN_MENU_ITEMS: ReadonlyArray<{
  label: string;
  href: string;
  glyph: string;
  /** -180° (왼쪽) ~ 0° (오른쪽). -90° = 위쪽. */
  angleDeg: number;
}> = [
  { label: '운세',   href: '/today-fortune?concern=general', glyph: '☀', angleDeg: -170 },
  { label: '사주',   href: '/saju/new',                       glyph: '辰', angleDeg: -130 },
  { label: '별자리', href: '/star-sign',                      glyph: '✦', angleDeg: -90  },
  { label: '띠운세', href: '/zodiac',                         glyph: '午', angleDeg: -50  },
  { label: '꿈해몽', href: '/dream',                          glyph: '☾', angleDeg: -10  },
];
const FAN_RADIUS = 105;
const FAN_MENU_LAYOUT: ReadonlyArray<{
  label: string;
  href: string;
  glyph: string;
  style: CSSProperties;
}> = FAN_MENU_ITEMS.map((entry) => {
  const angleRad = (entry.angleDeg * Math.PI) / 180;
  const x = Math.round(Math.cos(angleRad) * FAN_RADIUS);
  const y = Math.round(Math.sin(angleRad) * FAN_RADIUS);

  return {
    label: entry.label,
    href: entry.href,
    glyph: entry.glyph,
    style: {
      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
    },
  };
});

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
  // 2026-05-20 — 부모 컨테이너 (motion-page-transition-frame) 의 transform/will-change 가
  //   position:fixed 를 깸. dock 을 body 에 직접 portal mount 해서 viewport 고정 보장.
  //   PR #158 과 동일 패턴 (mobile-nav-sheet 에서 검증된 방식).
  const [portalMounted, setPortalMounted] = useState(false);
  // 2026-05-20 — 무료운세 부채꼴 메뉴 open state.
  const [fanMenuOpen, setFanMenuOpen] = useState(false);
  // 2026-06-30 — 포커스 체크아웃: 결제 화면에서는 하단 dock 을 숨겨(결제 CTA 만 노출)
  //   이탈/주의분산을 줄인다.
  const focusedCheckout = isFocusedCheckoutRoute(pathname);

  useEffect(() => {
    setMobileMenuOpen(false);
    setFanMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  return (
    <>
      <header
        className="app-top-header sticky top-0 z-40 border-b bg-white/95 backdrop-blur lg:hidden"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="app-top-header-inner app-top-header-main px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            {/* §Brand — 2026-05-14 리디자인: 컨텍스트 설명 제거, 한 줄 lockup */}
            {/* 2026-06-24 — 붓글씨 로고 이미지(간지사주 9,900원). picture(avif/webp/png 폴백). */}
            <Link href="/" className="app-top-brand min-w-0 flex items-center" aria-label="간지사주 홈">
              <picture>
                <source srcSet="/images/gangi/logo.avif" type="image/avif" />
                <source srcSet="/images/gangi/logo.webp" type="image/webp" />
                <img
                  src="/images/gangi/logo.png"
                  alt="간지사주 9,900원"
                  className="w-auto"
                  style={{ height: 28 }}
                  decoding="async"
                />
              </picture>
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
                    className="relative inline-flex shrink-0 items-center rounded-[10px] px-3 py-2 text-[15.5px] font-bold transition-colors"
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
              {/* 전 chip — desktop only, pink-soft */}
              <Link
                href="/credits"
                aria-label={`보유 전 ${creditLabel(user, credits)}`}
                className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[13.8px] font-extrabold md:inline-flex"
                style={{
                  background: 'var(--app-pink-soft)',
                  color: 'var(--app-pink-strong)',
                  border: '1px solid var(--app-pink-line)',
                }}
              >
                <span style={{ fontSize: 15 }} aria-hidden="true">✦</span>
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
                  className="hidden h-9 items-center rounded-full border bg-white px-3.5 text-[14.4px] font-extrabold text-[var(--app-copy-muted)] md:inline-flex"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  로그아웃
                </button>
              ) : (
                <Link
                  href={authHref}
                  className="hidden h-9 items-center rounded-full px-3.5 text-[14.4px] font-extrabold text-white md:inline-flex"
                  style={{
                    background: 'var(--app-pink)',
                    boxShadow: '0 6px 14px rgba(216,27,114,0.26)',
                  }}
                >
                  로그인
                </Link>
              )}

              {/* Hamburger — 36×36 outline circle. 2026-05-20: md:hidden → lg:hidden
                  로 확장. 태블릿 (768~1023px) 영역에서 dock 은 md:hidden 으로 사라지지만
                  mega-nav 는 lg+ 부터라 진입 vacuum 발생했음. 햄버거를 같이 lg:hidden 으로
                  옮기면 mobile-nav-sheet (lg+ 부터 강제 hidden) 가 태블릿에서도
                  MY 섹션 / 정책 / 보관함 등 추가 진입점으로 사용 가능. */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-global-menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-white text-[var(--app-ink)] transition-colors hover:bg-[var(--app-pink-soft)] lg:hidden"
                style={{ borderColor: 'var(--app-line)' }}
                aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              >
                {mobileMenuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

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
                    'app-top-category-chip shrink-0 rounded-full border px-3 py-1.5 text-base transition-colors',
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
          나머지 아이콘 통일된 크기 + 활성 시 상단 핑크 점 인디케이터.
          2026-05-20 (portal): body 직접 mount — 부모 transform 영향 차단.
          2026-06-30: 포커스 체크아웃 라우트에서는 dock 숨김. */}
      {portalMounted && !focusedCheckout
        ? createPortal(
            <nav
              className="app-mobile-dock fixed inset-x-0 bottom-0 z-40 md:hidden"
              aria-label="주 메뉴"
            >
              <div className="app-mobile-dock-inner grid w-full grid-cols-5">
                {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
                  const active = matchesPath(item, pathname);
                  const isCenter = item.label === '무료운세';

                  // 2026-05-20 — center (무료운세) FAB 은 Link 가 아니라 button.
                  //   클릭 시 부채꼴 메뉴 toggle (운세/사주/별자리/띠운세/꿈해몽).
                  if (isCenter) {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setFanMenuOpen((open) => !open)}
                        data-active={active}
                        data-center="true"
                        data-fan-open={fanMenuOpen ? 'true' : undefined}
                        aria-expanded={fanMenuOpen}
                        aria-label={fanMenuOpen ? '메뉴 닫기' : '무료운세 빠른 메뉴 열기'}
                        className="app-mobile-dock-link flex flex-col items-center justify-center px-2 py-2 text-center"
                      >
                        <span className="app-mobile-dock-icon">
                          {fanMenuOpen ? <X className="h-7 w-7" strokeWidth={2.6} /> : <DockIcon label={item.label} />}
                        </span>
                        <span className="app-mobile-dock-center-sparkle" aria-hidden="true">
                          <Sparkles className="h-2.5 w-2.5" />
                        </span>
                        <span className="app-mobile-dock-label mt-1 text-[12.6px] font-medium">
                          {fanMenuOpen ? '닫기' : getMobileDockLabel(item)}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      data-active={active}
                      aria-current={active ? 'page' : undefined}
                      className="app-mobile-dock-link flex flex-col items-center justify-center px-2 py-2 text-center"
                    >
                      {/* 활성 indicator dot */}
                      {active ? (
                        <span className="app-mobile-dock-indicator" aria-hidden="true" />
                      ) : null}
                      <span className="app-mobile-dock-icon">
                        <DockIcon label={item.label} />
                      </span>
                      <span className="app-mobile-dock-label mt-1 text-[12.6px] font-medium">
                        {getMobileDockLabel(item)}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* 2026-05-20 — 부채꼴 메뉴 (무료운세 FAB 클릭 시 펼침).
                  overlay 클릭 시 닫힘. 각 항목 클릭 시 라우트 이동 + 닫힘. */}
              {fanMenuOpen ? (
                <>
                  <div
                    className="app-fan-menu-overlay"
                    onClick={() => setFanMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="app-fan-menu" role="menu" aria-label="빠른 메뉴">
                    {FAN_MENU_LAYOUT.map((entry) => (
                      <Link
                        key={entry.label}
                        href={entry.href}
                        onClick={() => setFanMenuOpen(false)}
                        role="menuitem"
                        className="app-fan-menu-item"
                        style={entry.style}
                      >
                        <span className="app-fan-menu-icon" aria-hidden="true">
                          {entry.glyph}
                        </span>
                        <span className="app-fan-menu-label">{entry.label}</span>
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}
            </nav>,
            document.body
          )
        : null}

      {/* PR #156 — 모바일 메뉴 시트 (bottom sheet). 햄버거 토글에 mobileMenuOpen 연결. */}
      <MobileNavSheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        initialActiveLabel={resolveActiveGroup(pathname)}
      />
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
