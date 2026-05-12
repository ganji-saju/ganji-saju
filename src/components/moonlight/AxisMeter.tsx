import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AxisMeterProps {
  label: ReactNode;
  value: number;
  description?: ReactNode;
  className?: string;
}

function normalizeScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function AxisMeter({ label, value, description, className }: AxisMeterProps) {
  const normalized = normalizeScore(value);

  return (
    <div className={cn('rounded-[1.1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[var(--gyeol-text)]">{label}</div>
          {description ? (
            <div className="mt-1 text-xs leading-5 text-[var(--gyeol-muted)]">{description}</div>
          ) : null}
        </div>
        <strong className="text-lg font-bold text-[var(--gyeol-moon)]">{normalized}</strong>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--gyeol-surface)]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalized}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <span
          className="block h-full rounded-full bg-[var(--gyeol-moon)]"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}
