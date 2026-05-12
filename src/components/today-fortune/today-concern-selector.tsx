'use client';

import type { ComponentType } from 'react';
import { Briefcase, ChevronDown, ChevronUp, Heart, Sparkles, Wallet } from 'lucide-react';
import { ChoiceRow } from '@/components/moonlight/ChoiceRow';
import { getTodayConcernEntries } from '@/lib/today-fortune/concerns';
import type { ConcernId } from '@/lib/today-fortune/types';

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
      <div className={compact ? 'grid gap-2' : 'grid gap-2 sm:grid-cols-2'}>
        {items.map((item) => {
          const active = item.id === value;
          const Icon = CONCERN_ICON[item.id] ?? Sparkles;
          return (
            <ChoiceRow
              key={item.id}
              onClick={() => onChange(item.id)}
              selected={active}
              leading={<Icon className="h-5 w-5" aria-hidden="true" />}
              title={SIMPLE_LABEL[item.id] ?? item.shortLabel}
              description="오늘 필요한 한 줄로 보기"
              trailing={active ? '선택됨' : '선택'}
            />
          );
        })}
      </div>

      {onToggleExpanded ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-3 py-1.5 text-xs font-bold text-[var(--gyeol-muted)] transition-colors hover:border-[var(--gyeol-moon)]/35 hover:text-[var(--gyeol-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gyeol-moon)] focus-visible:ring-offset-2"
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
