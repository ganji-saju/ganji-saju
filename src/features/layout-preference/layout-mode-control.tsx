'use client';

import { startTransition, useEffect, useState } from 'react';
import { PanelLeft, PanelTop } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LayoutMode = 'vertical' | 'horizontal';

export const LAYOUT_MODE_STORAGE_KEY = 'moonlight:layout-mode-v3';

const LAYOUT_MODES: Array<{
  value: LayoutMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'vertical',
    label: '세로형',
    shortLabel: '세로',
    description: 'PC는 좌측 사이드바, 모바일은 하단 독으로 차분히 이어봅니다.',
  },
  {
    value: 'horizontal',
    label: '가로형',
    shortLabel: '가로',
    description: 'PC는 상단 네비, 모바일은 더 넓은 상단 바로가기로 빠르게 이동합니다.',
  },
];

function normalizeLayoutMode(value: string | null): LayoutMode {
  return value === 'horizontal' ? 'horizontal' : 'vertical';
}

function applyLayoutMode(mode: LayoutMode) {
  document.documentElement.dataset.appLayout = mode;
  try {
    window.localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  } catch {}
}

export function LayoutModeControl({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [mode, setMode] = useState<LayoutMode>('vertical');

  useEffect(() => {
    const storedMode = normalizeLayoutMode(
      window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY)
    );
    applyLayoutMode(storedMode);
    setMode(storedMode);
  }, []);

  function selectMode(nextMode: LayoutMode) {
    applyLayoutMode(nextMode);
    startTransition(() => setMode(nextMode));
  }

  return (
    <div
      className={cn(
        'rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-0.5',
        compact
          ? 'hidden items-center gap-0.5 lg:inline-flex'
          : 'hidden w-fit grid-cols-2 gap-0.5 lg:grid',
        className
      )}
      aria-label="레이아웃 보기 선택"
    >
      {LAYOUT_MODES.map((item) => {
        const selected = mode === item.value;
        const Icon = item.value === 'vertical' ? PanelLeft : PanelTop;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={selected}
            title={item.description}
            onClick={() => selectMode(item.value)}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12.6px] font-medium transition-colors',
              selected
                ? 'bg-[var(--app-gold)] text-[var(--app-bg)]'
                : 'text-[var(--app-copy-muted)] hover:bg-[var(--app-surface-strong)] hover:text-[var(--app-ivory)]',
              !compact && 'min-w-16'
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{compact ? item.shortLabel : item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
