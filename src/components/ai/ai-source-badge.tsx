type AiSourceBadgeState = 'idle' | 'loading' | 'openai' | 'fallback' | 'safe_redirect' | 'error';

const BADGE_COPY: Record<AiSourceBadgeState, { label: string; className: string }> = {
  idle: {
    label: '준비됨',
    className: 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]',
  },
  loading: {
    label: '응답 확인 중',
    className: 'border-[var(--app-gold)]/30 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
  },
  openai: {
    label: '정밀 해석',
    className: 'border-emerald-400/24 bg-emerald-400/10 text-emerald-200',
  },
  fallback: {
    label: '기본 해석',
    className: 'border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
  },
  safe_redirect: {
    label: '안전 안내',
    className: 'border-[var(--app-coral)]/32 bg-[var(--app-coral)]/10 text-[var(--app-coral)]',
  },
  error: {
    label: '확인 필요',
    className: 'border-[var(--app-coral)]/32 bg-[var(--app-coral)]/10 text-[var(--app-coral)]',
  },
};

interface AiSourceBadgeProps {
  state: AiSourceBadgeState;
}

export function AiSourceBadge({ state }: AiSourceBadgeProps) {
  const copy = BADGE_COPY[state];

  return (
    <span
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold tracking-[0.08em] ${copy.className}`}
    >
      {copy.label}
    </span>
  );
}
