// 2026-06-28 — 어드민 콘솔 공용 페이지 래퍼(와이드).
//   기존 어드민 페이지는 소비자용 AppShell+AppPage(gangi-subpage saju-result-page = 480px 고정)를
//   써서 데스크톱에서 좁게 갇혔다. 사이드바(AdminNav)가 생긴 지금 소비자 헤더/백링크/좁은 폭은
//   불필요 → 전 페이지를 이 풀폭 래퍼로 통일(대시보드와 동일 컨테이너).
import type { ReactNode } from 'react';

export function AdminPage({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** 헤더 우측 액션(필터·토글·버튼 등). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`w-full space-y-5 px-4 py-5 md:px-6 ${className ?? ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-line)] pb-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[var(--app-ink)]">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-[12.5px] text-[var(--app-copy-soft)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
