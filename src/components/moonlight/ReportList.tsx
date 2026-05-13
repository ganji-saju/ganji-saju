import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ReportBadgeKind =
  | 'saju'
  | 'saju-personality'
  | 'compatibility'
  | 'personality-compatibility'
  | 'today'
  | 'dialogue';

export interface ReportListItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  href: string;
  kind: ReportBadgeKind;
  meta?: ReactNode;
}

const REPORT_BADGE_LABELS: Record<ReportBadgeKind, string> = {
  saju: '사주',
  'saju-personality': '성향사주',
  compatibility: '궁합',
  'personality-compatibility': '성향궁합',
  today: '오늘운세',
  dialogue: '대화',
};

const REPORT_BADGE_CLASSNAMES: Record<ReportBadgeKind, string> = {
  saju: 'bg-[var(--gyeol-moon)]/10 text-[var(--gyeol-moon)]',
  'saju-personality': 'bg-[var(--gyeol-orbit)]/16 text-[var(--gyeol-text)]',
  compatibility: 'bg-rose-500/10 text-rose-700',
  'personality-compatibility': 'bg-amber-500/14 text-amber-800',
  today: 'bg-sky-500/10 text-sky-800',
  dialogue: 'bg-emerald-500/10 text-emerald-800',
};

export function ReportBadge({ kind }: { kind: ReportBadgeKind }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-bold',
        REPORT_BADGE_CLASSNAMES[kind]
      )}
    >
      {REPORT_BADGE_LABELS[kind]}
    </span>
  );
}

export function ReportList({
  items,
  empty,
  className,
}: {
  items: readonly ReportListItem[];
  empty?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-4 py-4 text-sm leading-6 text-[var(--gyeol-muted)]">
        {empty ?? '아직 다시 볼 리포트가 없습니다.'}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-2', className)}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="group flex min-h-16 w-full items-center justify-between gap-3 rounded-[1.15rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-3 text-left transition-colors hover:border-[var(--gyeol-moon)]/35 hover:bg-[var(--gyeol-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gyeol-moon)] focus-visible:ring-offset-2"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <ReportBadge kind={item.kind} />
              <strong className="text-base font-bold text-[var(--gyeol-text)]">{item.title}</strong>
            </span>
            {item.description ? (
              <span className="mt-1 block text-sm leading-6 text-[var(--gyeol-muted)]">
                {item.description}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-[var(--gyeol-muted)]">
            {item.meta ?? '재열람'}
            <span aria-hidden="true">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
