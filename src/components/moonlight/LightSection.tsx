import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface LightSectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  surface?: 'plain' | 'paper' | 'soft';
}

const SURFACE_CLASSNAME: Record<NonNullable<LightSectionProps['surface']>, string> = {
  plain: '',
  paper: 'rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-5 sm:p-6',
  soft: 'rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-5 sm:p-6',
};

export function LightSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  surface = 'paper',
}: LightSectionProps) {
  return (
    <section className={cn(SURFACE_CLASSNAME[surface], className)}>
      {eyebrow || title || description || actions ? (
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            {eyebrow ? (
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--gyeol-muted)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-xl font-bold leading-tight text-[var(--gyeol-text)] sm:text-2xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-[var(--gyeol-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
