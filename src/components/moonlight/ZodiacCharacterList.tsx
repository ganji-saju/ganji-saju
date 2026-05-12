import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ZodiacCharacterItem {
  id: string;
  name: ReactNode;
  animal: ReactNode;
  description?: ReactNode;
  href?: string;
  badge?: ReactNode;
  glyph?: ReactNode;
  fallbackHanja?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

interface ZodiacCharacterListProps {
  items: readonly ZodiacCharacterItem[];
  className?: string;
  selectedId?: string;
  onSelect?: (item: ZodiacCharacterItem) => void;
  ariaLabel?: string;
}

const ZODIAC_FALLBACK_HANJA: Record<string, string> = {
  쥐: '子',
  소: '丑',
  호랑이: '寅',
  토끼: '卯',
  용: '辰',
  뱀: '巳',
  말: '午',
  양: '未',
  원숭이: '申',
  닭: '酉',
  개: '戌',
  돼지: '亥',
};

const rowClassName =
  'group flex min-h-16 w-full items-center gap-3 rounded-[1.15rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3 text-left transition-colors hover:border-[var(--gyeol-moon)]/35 hover:bg-[var(--gyeol-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gyeol-moon)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 data-[selected=true]:border-[var(--gyeol-moon)]/45 data-[selected=true]:bg-[var(--gyeol-moon)]/8';

function getFallbackGlyph(item: ZodiacCharacterItem) {
  if (item.glyph) return item.glyph;
  if (item.fallbackHanja) return item.fallbackHanja;
  return typeof item.animal === 'string' ? ZODIAC_FALLBACK_HANJA[item.animal] ?? item.animal.slice(0, 1) : '?';
}

function ZodiacCharacterContent({ item }: { item: ZodiacCharacterItem }) {
  return (
    <>
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] text-base font-bold text-[var(--gyeol-moon)]"
        aria-hidden="true"
      >
        {getFallbackGlyph(item)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-base font-bold text-[var(--gyeol-text)]">{item.name}</strong>
          <span className="text-xs font-semibold text-[var(--gyeol-muted)]">{item.animal}</span>
          {item.badge ? (
            <span className="rounded-full border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-2 py-0.5 text-[11px] font-bold text-[var(--gyeol-muted)]">
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
      <span className="shrink-0 text-sm font-bold text-[var(--gyeol-muted)]" aria-hidden="true">
        →
      </span>
    </>
  );
}

export function ZodiacCharacterList({
  items,
  className,
  selectedId,
  onSelect,
  ariaLabel = '12간지 캐릭터 목록',
}: ZodiacCharacterListProps) {
  return (
    <div className={cn('grid gap-2', className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = selectedId === item.id;

        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.ariaLabel}
              aria-disabled={item.disabled ? 'true' : undefined}
              data-selected={selected}
              className={cn(rowClassName, item.disabled && 'pointer-events-none opacity-55')}
            >
              <ZodiacCharacterContent item={item} />
            </Link>
          );
        }

        if (onSelect) {
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              aria-label={item.ariaLabel}
              aria-pressed={selected}
              data-selected={selected}
              className={rowClassName}
              onClick={() => onSelect(item)}
            >
              <ZodiacCharacterContent item={item} />
            </button>
          );
        }

        return (
          <div
            key={item.id}
            data-selected={selected}
            className={cn(rowClassName, item.disabled && 'opacity-55')}
          >
            <ZodiacCharacterContent item={item} />
          </div>
        );
      })}
    </div>
  );
}
