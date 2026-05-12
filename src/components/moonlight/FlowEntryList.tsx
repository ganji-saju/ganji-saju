import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FlowEntryItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  onSelect?: () => void;
  badge?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  analyticsEvent?: string;
  analyticsSection?: string;
  analyticsTarget?: string;
  analyticsFeatureId?: string;
  analyticsServiceId?: string;
}

interface FlowEntryListProps {
  items: readonly FlowEntryItem[];
  className?: string;
}

const rowClassName =
  'group flex min-h-16 w-full items-center justify-between gap-3 rounded-[1.15rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3 text-left transition-colors hover:border-[var(--gyeol-moon)]/35 hover:bg-[var(--gyeol-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gyeol-moon)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55';

function FlowEntryContent({ item }: { item: FlowEntryItem }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-bold text-[var(--gyeol-text)]">{item.title}</strong>
          {item.badge ? (
            <span className="rounded-full bg-[var(--gyeol-moon)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--gyeol-moon)]">
              {item.badge}
            </span>
          ) : null}
        </span>
        {item.description ? (
          <span className="mt-1 block text-sm leading-6 text-[var(--gyeol-muted)]">
            {item.description}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-[var(--gyeol-muted)]">
        {item.meta}
        <span aria-hidden="true">→</span>
      </span>
    </>
  );
}

export function FlowEntryList({ items, className }: FlowEntryListProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      {items.map((item) =>
        item.href ? (
          <Link
            key={item.id}
            href={item.href}
            aria-label={item.ariaLabel}
            aria-disabled={item.disabled ? 'true' : undefined}
            data-analytics-event={item.analyticsEvent}
            data-analytics-section={item.analyticsSection}
            data-analytics-target={item.analyticsTarget}
            data-analytics-feature-id={item.analyticsFeatureId}
            data-analytics-service-id={item.analyticsServiceId}
            className={cn(rowClassName, item.disabled && 'pointer-events-none')}
          >
            <FlowEntryContent item={item} />
          </Link>
        ) : (
          <button
            key={item.id}
            type="button"
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            onClick={item.onSelect}
            data-analytics-event={item.analyticsEvent}
            data-analytics-section={item.analyticsSection}
            data-analytics-target={item.analyticsTarget}
            data-analytics-feature-id={item.analyticsFeatureId}
            data-analytics-service-id={item.analyticsServiceId}
            className={rowClassName}
          >
            <FlowEntryContent item={item} />
          </button>
        )
      )}
    </div>
  );
}
