import type { ReactNode } from 'react';
import SiteFooter from '@/components/site-footer';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
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
  const footerNode =
    footer === false || footer === null ? null : footer ?? <SiteFooter />;

  return (
    <main className={cn('app-shell', header && 'app-shell-with-navigation', className)}>
      {header}
      <div className="app-shell-content">{children}</div>
      {footerNode}
      {dock}
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
