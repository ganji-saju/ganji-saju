/**
 * <RetryButton /> — 표준 재시도 버튼 — Phase 5-A (2026-05-18).
 *
 * ErrorState 외에도 toast / inline 위치에서 단독 사용.
 */
'use client';

import { useState } from 'react';

interface RetryButtonProps {
  onRetry: () => Promise<void> | void;
  label?: string;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary';
}

export function RetryButton({
  onRetry,
  label = '다시 시도',
  loadingLabel = '재시도 중...',
  variant = 'primary',
}: RetryButtonProps) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      await onRetry();
    } finally {
      setPending(false);
    }
  };

  const base =
    'rounded-[10px] px-3 py-2 text-[12.5px] font-bold disabled:opacity-50';
  const skin =
    variant === 'primary'
      ? 'bg-[var(--app-pink-strong)] text-white'
      : 'border bg-white text-[var(--app-copy)]';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`${base} ${skin}`}
      style={variant === 'secondary' ? { borderColor: 'var(--app-line)' } : undefined}
    >
      {pending ? loadingLabel : label}
    </button>
  );
}
