import type { ReactNode } from 'react';
import SiteFooter from '@/components/site-footer';
import { MegaNavBar } from '@/features/shared-navigation/mega-nav';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ScrollToTopButton } from '@/shared/layout/scroll-to-top-button';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  header?: ReactNode | null | false;
  dock?: ReactNode;
  footer?: ReactNode | null | false;
  className?: string;
}

interface AppPageProps {
  children: ReactNode;
  className?: string;
}

interface PageHeroProps {
  title: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  className?: string;
}

export function AppShell({ children, header, dock, footer, className }: AppShellProps) {
  const headerNode =
    header === false || header === null ? null : header ?? <SiteHeader />;
  const footerNode =
    footer === false || footer === null ? null : footer ?? <SiteFooter />;

  return (
    <main className={cn('app-shell', headerNode && 'app-shell-with-navigation', className)}>
      {/* PR #155 — PC 메가 메뉴 (lg+ 에서만 표시, CSS 로 제어).
          mobile/tablet 은 기존 SiteHeader 가 그대로 노출. */}
      <MegaNavBar />
      {headerNode}
      <div className="app-shell-content">{children}</div>
      {footerNode}
      {dock}
      {/* 2026-05-20 — 모든 페이지 우측 하단에 "맨 위로" floating 버튼.
          320px 이상 스크롤 시 fade-in. 모바일 dock 위에 자동 배치. */}
      <ScrollToTopButton />
    </main>
  );
}

export function AppPage({ children, className }: AppPageProps) {
  return <div className={cn('app-page app-page-spacious', className)}>{children}</div>;
}

export function PageHero({ title, description, badges, className }: PageHeroProps) {
  return (
    <section className={cn('app-hero-card p-6 sm:p-8', className)}>
      {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
      <h1 className="app-hero-title mt-5">{title}</h1>
      {description ? (
        <p className="app-hero-description mt-4 max-w-3xl">{description}</p>
      ) : null}
    </section>
  );
}
