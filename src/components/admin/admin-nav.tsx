'use client';
// 2026-06-28 — 어드민 콘솔 영속 내비게이션. layout 에서 role 받아 렌더.
//   데스크톱: 좌측 사이드바 / 모바일: 상단바 + 햄버거 드로어.
//   활성 경로 하이라이트는 getActiveNavHref(가장 구체적 항목) 기준.
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/admin-auth';
import { getVisibleNavGroups, getActiveNavHref } from '@/lib/admin/nav';

function NavList({
  role,
  activeHref,
  onNavigate,
}: {
  role: AdminRole;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  const groups = getVisibleNavGroups(role);
  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--app-copy-muted)]">
            {group.title}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-[13.5px] font-semibold transition-colors ${
                      active
                        ? 'bg-[var(--app-pink-strong)] text-white'
                        : 'text-[var(--app-ink)] hover:bg-[var(--app-pink-soft)]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.minRole === 'super_admin' ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                          active ? 'bg-white/25 text-white' : 'bg-[var(--app-line)] text-[var(--app-copy-soft)]'
                        }`}
                        title="super_admin 전용"
                      >
                        S
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname() ?? '/admin';
  const activeHref = getActiveNavHref(pathname);
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 모바일 상단바 */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--app-line)] bg-white px-4 py-3 md:hidden">
        <Link href="/admin" className="text-[15px] font-extrabold text-[var(--app-ink)]">
          관리자 콘솔
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴 열기"
          aria-expanded={open}
          className="rounded-[8px] border border-[var(--app-line)] px-3 py-1.5 text-[13px] font-bold text-[var(--app-ink)]"
        >
          {open ? '닫기' : '메뉴'}
        </button>
      </div>

      {/* 모바일 드로어 */}
      {open ? (
        <div className="border-b border-[var(--app-line)] bg-white px-4 py-4 md:hidden">
          <NavList role={role} activeHref={activeHref} onNavigate={() => setOpen(false)} />
        </div>
      ) : null}

      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-[var(--app-line)] bg-white px-3 py-5 md:block">
        <Link href="/admin" className="block px-2 text-[16px] font-extrabold text-[var(--app-ink)]">
          관리자 콘솔
        </Link>
        <p className="mb-4 px-2 text-[11px] font-semibold text-[var(--app-copy-muted)]">
          {role === 'super_admin' ? 'super_admin' : 'admin'}
        </p>
        <NavList role={role} activeHref={activeHref} />
      </aside>
    </>
  );
}
