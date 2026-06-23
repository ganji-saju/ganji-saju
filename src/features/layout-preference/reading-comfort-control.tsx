'use client';

import { startTransition, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type ReadingComfortMode = 'standard' | 'large';

export const READING_COMFORT_STORAGE_KEY = 'moonlight:reading-comfort-v1';

const READING_COMFORT_MODES: Array<{
  value: ReadingComfortMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'standard',
    label: '기본',
    shortLabel: '기본',
    description: '일반 글자 크기와 간격으로 봅니다.',
  },
  {
    value: 'large',
    label: '큰글씨',
    shortLabel: '크게',
    description: '글자, 버튼, 줄간격을 크게 잡아 천천히 읽기 좋게 봅니다.',
  },
];

function normalizeReadingComfortMode(value: string | null): ReadingComfortMode {
  return value === 'large' ? 'large' : 'standard';
}

function applyReadingComfortMode(mode: ReadingComfortMode) {
  document.documentElement.dataset.readingComfort = mode;
  try {
    window.localStorage.setItem(READING_COMFORT_STORAGE_KEY, mode);
  } catch {}
}

export function ReadingComfortControl({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [mode, setMode] = useState<ReadingComfortMode>('standard');

  useEffect(() => {
    const storedMode = normalizeReadingComfortMode(
      window.localStorage.getItem(READING_COMFORT_STORAGE_KEY)
    );
    applyReadingComfortMode(storedMode);
    setMode(storedMode);
  }, []);

  function selectMode(nextMode: ReadingComfortMode) {
    applyReadingComfortMode(nextMode);
    startTransition(() => setMode(nextMode));
  }

  return (
    <div
      className={cn(
        'rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-0.5',
        compact ? 'inline-flex items-center gap-0.5' : 'grid w-full grid-cols-2 gap-0.5',
        className
      )}
      aria-label="글자 크기 보기 선택"
    >
      {READING_COMFORT_MODES.map((item) => {
        const selected = mode === item.value;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={selected}
            title={item.description}
            onClick={() => selectMode(item.value)}
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors',
              selected
                ? 'bg-[var(--app-gold)] text-[var(--app-bg)]'
                : 'text-[var(--app-copy-muted)] hover:bg-[var(--app-surface-strong)] hover:text-[var(--app-ivory)]'
            )}
          >
            <span>{compact ? item.shortLabel : item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
