import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FusionStrip } from './FusionStrip';

interface FusionHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function FusionHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className,
}: FusionHeroProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[1.5rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-5 sm:p-7',
        className
      )}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:items-end">
        <div className="space-y-5">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gyeol-muted)]">
              {eyebrow}
            </p>
          ) : null}
          <div className="space-y-3">
            <h1 className="max-w-3xl text-balance text-3xl font-bold leading-tight text-[var(--gyeol-text)] sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-base leading-7 text-[var(--gyeol-muted)] sm:text-lg">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        <div className="space-y-3">
          <FusionStrip />
          {aside}
        </div>
      </div>
    </section>
  );
}
