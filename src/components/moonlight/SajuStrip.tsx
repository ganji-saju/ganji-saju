import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SajuStripProps {
  className?: string;
  prefixLabel?: ReactNode;
  suffixLabel?: ReactNode;
}

const SAJU_PILLARS = ['年', '月', '日', '時'] as const;

export function SajuStrip({
  className,
  prefixLabel = '사주',
  suffixLabel = '네 기둥',
}: SajuStripProps) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-3 py-3 text-[var(--gyeol-text)]',
        className
      )}
      aria-label="사주 네 기둥을 기준으로 결과를 읽는 구조"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--gyeol-muted)]">
        <span>{prefixLabel}</span>
        <span className="h-px min-w-6 flex-1 bg-[var(--gyeol-line)]" aria-hidden="true" />
        <span>{suffixLabel}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {SAJU_PILLARS.map((pillar) => (
          <span
            key={pillar}
            className="grid h-9 min-w-9 place-items-center rounded-xl border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] text-base font-bold"
          >
            {pillar}
          </span>
        ))}
      </div>
    </div>
  );
}
