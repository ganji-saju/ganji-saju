import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StepFlowShellProps {
  currentStep: number;
  totalSteps: number;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function StepFlowShell({
  currentStep,
  totalSteps,
  title,
  description,
  children,
  footer,
  className,
}: StepFlowShellProps) {
  const safeTotal = Math.max(1, totalSteps);
  const safeCurrent = Math.min(Math.max(1, currentStep), safeTotal);
  const progress = Math.round((safeCurrent / safeTotal) * 100);

  return (
    <section className={cn('space-y-5', className)}>
      <header className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-5">
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-[var(--gyeol-muted)]">
          <span>
            {safeCurrent} / {safeTotal}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--gyeol-surface)]">
          <span
            className="block h-full rounded-full bg-[var(--gyeol-moon)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <h1 className="mt-5 text-2xl font-bold leading-tight text-[var(--gyeol-text)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--gyeol-muted)]">{description}</p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
      {footer ? <div>{footer}</div> : null}
    </section>
  );
}
