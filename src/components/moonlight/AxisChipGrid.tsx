import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AxisChipItem {
  id: string;
  label: ReactNode;
  value?: number | string;
  description?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

interface AxisChipGridProps {
  items: readonly AxisChipItem[];
  className?: string;
  selectedId?: string;
  onSelect?: (item: AxisChipItem) => void;
}

function AxisChipContent({ item }: { item: AxisChipItem }) {
  return (
    <>
      <div className="text-sm font-bold text-[var(--gyeol-text)]">{item.label}</div>
      {item.value !== undefined ? (
        <div className="mt-2 text-2xl font-bold text-[var(--gyeol-moon)]">{item.value}</div>
      ) : null}
      {item.description ? (
        <div className="mt-1 text-xs leading-5 text-[var(--gyeol-muted)]">
          {item.description}
        </div>
      ) : null}
    </>
  );
}

export function AxisChipGrid({ items, className, selectedId, onSelect }: AxisChipGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)}>
      {items.map((item) => {
        const selected = selectedId === item.id;
        const itemClassName = cn(
          'min-h-24 rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-3 text-left transition-colors',
          onSelect &&
            'hover:border-[var(--gyeol-moon)]/35 hover:bg-[var(--gyeol-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gyeol-moon)] focus-visible:ring-offset-2',
          selected && 'border-[var(--gyeol-moon)]/45 bg-[var(--gyeol-moon)]/8',
          item.disabled && 'cursor-not-allowed opacity-55'
        );

        return onSelect ? (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            aria-label={item.ariaLabel}
            aria-pressed={selected}
            className={itemClassName}
            onClick={() => onSelect(item)}
          >
            <AxisChipContent item={item} />
          </button>
        ) : (
          <div key={item.id} className={itemClassName}>
            <AxisChipContent item={item} />
          </div>
        );
      })}
    </div>
  );
}
