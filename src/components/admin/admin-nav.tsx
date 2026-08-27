'use client';
// 2026-06-28 — 어드민 콘솔 영속 내비게이션. layout 에서 role 받아 렌더.
//   데스크톱: 좌측 사이드바 / 모바일: 상단바 + 드로어.
//   활성 경로 하이라이트는 getActiveNavHref(가장 구체적 항목) 기준.
//
// 2026-08-27 — B안: 어두운 레일 + 2단 메뉴.
//   ① 메뉴와 본문의 경계를 1px 선이 아니라 **밝기 차**가 만든다. 스크롤해도 "여기는 메뉴"가
//      흔들리지 않는다(기존엔 둘 다 흰색이라 경계가 선 하나였다).
//   ② 활성 표시를 인주로 꽉 채우지 않는다 — 항목이 15개라 채움은 너무 시끄러웠다.
//      왼쪽 2px 바 + 20% 인주 배경으로 바꾼다.
//   ③ 권한 뱃지(S, 테두리)와 대기 작업 뱃지(숫자, 채움)를 다른 모양으로 갈랐다.
//   ⚠️ 시안에 있던 ⌘K 검색 상자는 넣지 않았다 — 그런 기능이 없다. 사용자 검색은
//      '사용자 조회'(/admin/users)가 이미 하는 일이라 가짜 입력창을 두지 않는다.
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/admin-auth';
import {
  getVisibleNavGroups,
  getActiveNavHref,
  navItemContainsHref,
  type AdminNavItem,
} from '@/lib/admin/nav';

/** super_admin 전용 표시 — 테두리만. 채운 뱃지는 '할 일'의 몫이라 겹치면 안 된다. */
function RoleBadge() {
  return (
    <span
      title="super_admin 전용"
      className="ml-auto shrink-0 rounded-[3px] border border-white/20 px-1 text-[11px] font-bold tracking-[.04em] text-[var(--admin-rail-ink-2)]"
    >
      S
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`ml-auto shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--admin-rail-label)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function LeafLink({
  item,
  active,
  depth,
  onNavigate,
  touch,
}: {
  item: AdminNavItem;
  active: boolean;
  depth: 0 | 1;
  onNavigate?: () => void;
  touch: boolean;
}) {
  const height = touch ? 'min-h-[48px]' : depth === 1 ? 'h-[27px]' : 'h-[29px]';
  const size = depth === 1 ? 'text-[11.5px] font-normal' : 'text-[13px] font-medium';
  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      title={item.description}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-2 rounded-[6px] px-2.5 ${height} ${
        touch ? 'text-[14px] font-medium' : size
      } transition-colors ${
        active
          ? 'bg-[var(--admin-rail-active)] font-semibold text-white'
          : `${depth === 1 ? 'text-[var(--admin-rail-ink-2)]' : 'text-[var(--admin-rail-ink)]'} hover:bg-[var(--admin-rail-hover)]`
      }`}
    >
      {active ? (
        <span
          aria-hidden
          className={`absolute ${depth === 1 ? '-left-[11px]' : 'left-0'} top-1 bottom-1 w-[2px] rounded-[1px] bg-[var(--admin-accent-lift)]`}
        />
      ) : null}
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto flex h-4 min-w-[17px] shrink-0 items-center justify-center rounded-full bg-[var(--app-coral)] px-1.5 text-[11px] font-bold text-white">
          {item.badge}
        </span>
      ) : item.minRole === 'super_admin' ? (
        <RoleBadge />
      ) : null}
    </Link>
  );
}

function NavList({
  role,
  activeHref,
  onNavigate,
  touch = false,
}: {
  role: AdminRole;
  activeHref: string | null;
  onNavigate?: () => void;
  touch?: boolean;
}) {
  const groups = getVisibleNavGroups(role);
  // 부모 접기 상태. 기본값은 "지금 열린 화면을 품고 있나" — 눌러서 뒤집은 것만 기억한다.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex flex-col gap-0.5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p
            className={`px-2.5 ${touch ? 'flex h-[38px] items-center' : 'mt-2.5 mb-0.5'} text-[11px] font-semibold uppercase tracking-[.09em] text-[var(--admin-rail-label)]`}
          >
            {group.title}
          </p>
          {group.items.map((item) => {
            if (!item.children) {
              return (
                <LeafLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                  depth={0}
                  onNavigate={onNavigate}
                  touch={touch}
                />
              );
            }
            const open = toggled[item.label] ?? navItemContainsHref(item, activeHref);
            return (
              <div key={item.label} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setToggled((prev) => ({ ...prev, [item.label]: !open }))}
                  className={`flex w-full items-center gap-2 rounded-[6px] px-2.5 ${
                    touch ? 'min-h-[48px] text-[14px]' : 'h-[29px] text-[13px]'
                  } font-semibold text-[var(--admin-rail-ink-strong)] transition-colors hover:bg-[var(--admin-rail-hover)]`}
                >
                  <span className="truncate">{item.label}</span>
                  <Chevron open={open} />
                </button>
                {open ? (
                  <div className="ml-2.5 flex flex-col gap-0.5 border-l border-white/10 pl-2.5">
                    {item.children.map((child) => (
                      <LeafLink
                        key={child.href}
                        item={child}
                        active={child.href === activeHref}
                        depth={1}
                        onNavigate={onNavigate}
                        touch={touch}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand({ role }: { role: AdminRole }) {
  return (
    <Link href="/admin" className="flex items-center gap-2">
      <span className="flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--admin-accent-lift)] text-[11.5px] font-bold text-white">
        간
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold tracking-[-.01em] text-[var(--admin-rail-ink-strong)]">
          관리자 콘솔
        </span>
        <span className="text-[11px] text-[var(--admin-rail-label)]">
          {role === 'super_admin' ? 'super_admin' : 'admin'}
        </span>
      </span>
    </Link>
  );
}

function SiteLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-[6px] px-2.5 py-2 text-[11.5px] font-medium text-[var(--admin-rail-label)] transition-colors hover:bg-[var(--admin-rail-hover)] hover:text-[var(--admin-rail-ink)]"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
      </svg>
      사이트로 가기
    </Link>
  );
}

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname() ?? '/admin';
  const activeHref = getActiveNavHref(pathname);
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 모바일 상단바 — 레일과 같은 어두운 면이라 드로어가 열려도 층이 이어진다. */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-[var(--admin-rail)] px-4 py-3 md:hidden">
        <Brand role={role} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={open}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--admin-rail-ink-strong)]"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12" /><path d="M18 6L6 18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
              <path d="M5 6h14" /><path d="M5 12h14" /><path d="M5 18h14" />
            </svg>
          )}
        </button>
      </div>

      {/* 모바일 드로어 — 데스크톱 밀도(29px)를 손가락에 그대로 내리지 않는다(48px). */}
      {open ? (
        <div className="bg-[var(--admin-rail)] px-2.5 pb-4 md:hidden">
          <NavList role={role} activeHref={activeHref} onNavigate={() => setOpen(false)} touch />
          <div className="mt-3 border-t border-[var(--admin-rail-line)] pt-2">
            <SiteLink onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      {/* 데스크톱 레일 */}
      <aside className="sticky top-0 hidden h-dvh w-[208px] shrink-0 flex-col overflow-y-auto bg-[var(--admin-rail)] md:flex">
        <div className="border-b border-[var(--admin-rail-line)] px-3.5 pb-3 pt-3.5">
          <Brand role={role} />
        </div>
        <div className="flex-1 px-2.5 pb-3 pt-2">
          <NavList role={role} activeHref={activeHref} />
        </div>
        <div className="border-t border-[var(--admin-rail-line)] px-2.5 py-2">
          <SiteLink />
        </div>
      </aside>
    </>
  );
}
