'use client';

import type { ComponentType } from 'react';
import { Briefcase, ChevronDown, ChevronUp, Heart, Sparkles, Wallet } from 'lucide-react';
import { getTodayConcernEntries } from '@/lib/today-fortune/concerns';
import type { ConcernId } from '@/lib/today-fortune/types';
import { cn } from '@/lib/utils';

const CONCERN_ICON: Partial<Record<ConcernId, ComponentType<{ className?: string }>>> = {
  general: Sparkles,
  love_contact: Heart,
  money_spend: Wallet,
  work_meeting: Briefcase,
};

const SIMPLE_LABEL: Partial<Record<ConcernId, string>> = {
  general: '전체 흐름',
  love_contact: '연애·마음',
  money_spend: '돈·재물',
  work_meeting: '일·직장',
};
interface TodayConcernSelectorProps {
  value: ConcernId;
  onChange: (value: ConcernId) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  compact?: boolean;
}

export function TodayConcernSelector({
  value,
  onChange,
  expanded = false,
  onToggleExpanded,
  compact = false,
}: TodayConcernSelectorProps) {
  const items = getTodayConcernEntries(expanded);

  return (
    <div className="space-y-4">
      <div className={cn('today-concern-grid', compact && 'today-concern-grid-compact')}>
        {items.map((item) => {
          const active = item.id === value;
          const Icon = CONCERN_ICON[item.id] ?? Sparkles;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className="today-concern-card"
              data-active={active ? 'true' : 'false'}
            >
              <span className="today-concern-icon">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <strong>{SIMPLE_LABEL[item.id] ?? item.shortLabel}</strong>
              <em>지금 한 줄로</em>
            </button>
          );
        })}
      </div>

      {onToggleExpanded ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white px-3 py-1.5 text-xs font-black text-[var(--app-copy-muted)] transition-colors hover:border-[var(--app-pink-line)] hover:text-[var(--app-pink-strong)]"
        >
          {expanded ? (
            <>
              접기 <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              더 보기 <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
