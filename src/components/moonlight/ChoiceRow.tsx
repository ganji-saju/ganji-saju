import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChoiceRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
}

export function ChoiceRow({
  title,
  description,
  leading,
  trailing,
  selected = false,
  className,
  type = 'button',
  ...props
}: ChoiceRowProps) {
  return (
    <button
      type={type}
      data-selected={selected}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-[1.15rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3 text-left transition-colors hover:border-[var(--gyeol-moon)]/35 hover:bg-[var(--gyeol-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gyeol-moon)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 data-[selected=true]:border-[var(--gyeol-moon)]/45 data-[selected=true]:bg-[var(--gyeol-moon)]/8',
        className
      )}
      {...props}
    >
      {leading ? (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--gyeol-surface)] text-sm font-bold text-[var(--gyeol-moon)]">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <strong className="block text-base font-bold text-[var(--gyeol-text)]">{title}</strong>
        {description ? (
          <span className="mt-1 block text-sm leading-6 text-[var(--gyeol-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 text-sm font-bold text-[var(--gyeol-muted)]">{trailing}</span>
      ) : null}
    </button>
  );
}
