'use client';
// 2026-08-27 — 페이지 상단 탭(서브메뉴). 형제 화면(지표 4종 · 사주/명리 검증)을 오갈 때
//   왼쪽 레일까지 시선을 보내지 않게 한다.
//
//   ⚠️ 목록을 화면에 적지 않는다 — nav.ts 의 부모/자식 구조에서 그대로 파생시킨다.
//      따로 적으면 레일엔 있는데 탭엔 없는 항목이 생기고, 그 어긋남은 조용하다.
//   부모가 없는 화면(대시보드·사용자 조회 등)에서는 아무것도 렌더하지 않는다.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/lib/admin-auth';
import { getVisibleNavGroups, getActiveNavHref, findNavParent } from '@/lib/admin/nav';

export function AdminSectionTabs({ role }: { role: AdminRole }) {
  const pathname = usePathname() ?? '/admin';
  const activeHref = getActiveNavHref(pathname);
  const parent = findNavParent(getVisibleNavGroups(role), activeHref);
  if (!parent?.children || parent.children.length < 2) return null;

  return (
    <div className="z-20 flex items-end gap-0 md:sticky md:top-0 overflow-x-auto border-b border-[var(--app-line)] bg-[var(--app-surface)] px-4 md:px-6">
      {parent.children.map((child) => {
        const active = child.href === activeHref;
        return (
          <Link
            key={child.href}
            href={child.href!}
            title={child.description}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap px-3 pb-2.5 pt-3 text-[13px] transition-colors ${
              active
                ? 'font-semibold text-[var(--app-ink)] shadow-[inset_0_-2px_0_var(--app-pink)]'
                : 'font-medium text-[var(--app-copy-muted)] hover:text-[var(--app-ink)]'
            }`}
          >
            {child.label}
          </Link>
        );
      })}
    </div>
  );
}
