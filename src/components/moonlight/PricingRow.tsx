import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PricingRowProps {
  title: ReactNode;
  description?: ReactNode;
  price: ReactNode;
  href: string;
  ctaLabel?: ReactNode;
  eyebrow?: ReactNode;
  badge?: ReactNode;
  emphasis?: boolean;
  className?: string;
}

export function PricingRow({
  title,
  description,
  price,
  href,
  ctaLabel = '보기',
  eyebrow,
  badge,
  emphasis = false,
  className,
}: PricingRowProps) {
  return (
    <Link
      href={href}
      data-emphasis={emphasis ? 'true' : undefined}
      className={cn(
        'group flex min-h-20 flex-col gap-3 rounded-[1.15rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-4 transition-colors hover:border-[var(--gyeol-moon)]/35 hover:bg-[var(--gyeol-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gyeol-moon)] focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between',
        'data-[emphasis=true]:border-[var(--gyeol-moon)]/35 data-[emphasis=true]:bg-[var(--gyeol-moon)]/8',
        className
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {eyebrow ? (
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--gyeol-muted)]">
              {eyebrow}
            </span>
          ) : null}
          {badge ? (
            <span className="rounded-full bg-[var(--gyeol-moon)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--gyeol-moon)]">
              {badge}
            </span>
          ) : null}
        </span>
        <strong className="mt-1 block text-base font-bold text-[var(--gyeol-text)]">{title}</strong>
        {description ? (
          <span className="mt-1 block text-sm leading-6 text-[var(--gyeol-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <strong className="text-base font-bold text-[var(--gyeol-moon)]">{price}</strong>
        <span className="rounded-full border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-3 py-1 text-xs font-bold text-[var(--gyeol-text)]">
          {ctaLabel}
        </span>
      </span>
    </Link>
  );
}
