import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResultShellProps {
  title: ReactNode;
  summary?: ReactNode;
  keywords?: readonly ReactNode[];
  scoreSummary?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ResultShell({
  title,
  summary,
  keywords,
  scoreSummary,
  actions,
  children,
  className,
}: ResultShellProps) {
  return (
    <article className={cn('space-y-5', className)}>
      <header className="rounded-[1.5rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-5 sm:p-6">
        <h1 className="text-2xl font-bold leading-tight text-[var(--gyeol-text)] sm:text-3xl">
          {title}
        </h1>
        {summary ? <p className="mt-3 text-base leading-7 text-[var(--gyeol-muted)]">{summary}</p> : null}
        {keywords?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <span
                key={index}
                className="rounded-full border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-3 py-1 text-xs font-bold text-[var(--gyeol-text)]"
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : null}
        {scoreSummary ? <div className="mt-5">{scoreSummary}</div> : null}
        {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </article>
  );
}
