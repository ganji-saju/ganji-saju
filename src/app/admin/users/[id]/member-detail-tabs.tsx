'use client';
import { useState, type ReactNode } from 'react';

export interface DetailTab {
  key: string;
  label: string;
  content: ReactNode;
}

export function MemberDetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`rounded-full px-3 py-1 text-[13.8px] font-bold ${
              t.key === current?.key
                ? 'bg-[var(--app-pink-strong)] text-white'
                : 'border border-[var(--app-line)] text-[var(--app-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
