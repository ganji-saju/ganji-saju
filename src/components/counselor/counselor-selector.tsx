'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  MOONLIGHT_COUNSELORS,
  type MoonlightCounselorId,
} from '@/lib/counselors';

interface CounselorSelectorProps {
  value: MoonlightCounselorId;
  onChange: (counselorId: MoonlightCounselorId) => void;
  variant?: 'hero' | 'compact';
  className?: string;
  title?: string;
  description?: string;
}

export function CounselorSelector({
  value,
  onChange,
  variant = 'compact',
  className,
  title,
  description,
}: CounselorSelectorProps) {
  const compact = variant === 'compact';

  return (
    <div className={cn('space-y-3', className)}>
      {title || description ? (
        <div>
          {title ? (
            <div className="text-base font-semibold text-[var(--app-ivory)]">{title}</div>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[var(--app-copy-soft)]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'lg:grid-cols-2')}>
        {Object.values(MOONLIGHT_COUNSELORS).map((counselor) => {
          const selected = counselor.id === value;

          return (
            <button
              key={counselor.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(counselor.id)}
              className={cn(
                'group relative overflow-hidden border text-left transition-[transform,border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-gold)]/70',
                compact
                  ? 'rounded-[1.1rem] bg-[rgba(8,10,18,0.52)] p-2.5 hover:-translate-y-0.5 sm:rounded-[1.25rem] sm:p-3'
                  : 'rounded-[1.6rem] bg-[rgba(8,10,18,0.45)] p-4 hover:-translate-y-1',
                selected
                  ? `${counselor.borderClassName} ${counselor.surfaceClassName} shadow-[0_18px_44px_rgba(0,0,0,0.28)]`
                  : 'border-[var(--app-line)] hover:border-[var(--app-line-strong)] hover:bg-[rgba(16,20,38,0.72)]'
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_24%,rgba(255,255,255,0.02))]" />
              <div className={cn('relative z-10 grid items-center gap-2 sm:gap-3', compact ? 'grid-cols-[3.1rem_1fr] sm:grid-cols-[4.4rem_1fr]' : 'grid-cols-[6rem_1fr]')}>
                <div className={cn('relative overflow-hidden rounded-[1rem] border border-white/10 bg-[rgba(255,255,255,0.04)]', compact ? 'aspect-[4/5]' : 'aspect-[4/5]')}>
                  <Image
                    src={counselor.imagePath}
                    alt={counselor.imageAlt}
                    fill
                    sizes={compact ? '(max-width: 640px) 28vw, 11rem' : '(max-width: 640px) 34vw, 16rem'}
                    className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,18,0.04),rgba(8,10,18,0.08)_48%,rgba(8,10,18,0.42))]" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[12.6px] font-semibold uppercase tracking-[0.22em]', counselor.accentClassName)}>
                      {counselor.shortLabel}
                    </span>
                    {selected ? (
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11.5px] font-semibold',
                          counselor.borderClassName,
                          counselor.accentClassName,
                          counselor.surfaceClassName
                        )}
                      >
                        선택됨
                      </span>
                    ) : null}
                  </div>
                  <div className={cn('mt-2 font-semibold text-[var(--app-ivory)]', compact ? 'text-base leading-6' : 'text-xl leading-7')}>
                    {counselor.title}
                  </div>
                  <p className={cn('mt-2 text-[var(--app-copy)]', compact ? 'hidden text-sm leading-6 sm:block' : 'text-base leading-7')}>
                    {compact ? counselor.focus : counselor.description}
                  </p>
                  {!compact ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--app-copy-soft)]">
                      {counselor.signature}
                    </p>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
