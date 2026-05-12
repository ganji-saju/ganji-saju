import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageIntroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: PageIntroProps) {
  return (
    <section className={cn('space-y-5', className)}>
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gyeol-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-3xl text-balance text-3xl font-bold leading-tight text-[var(--gyeol-text)] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-base leading-7 text-[var(--gyeol-muted)] sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {children}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}
