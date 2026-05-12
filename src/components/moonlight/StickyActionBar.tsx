import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StickyActionBarProps {
  children: ReactNode;
  note?: ReactNode;
  className?: string;
}

export function StickyActionBar({ children, note, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-30 -mx-4 border-t border-[var(--gyeol-line)] bg-white/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-6 sm:px-6',
        className
      )}
    >
      {note ? <p className="mb-2 text-center text-xs leading-5 text-[var(--gyeol-muted)]">{note}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{children}</div>
    </div>
  );
}
