import { cn } from '@/lib/utils';

export interface EvidenceStripItem {
  title?: string;
  body: string;
}

interface EvidenceStripProps {
  items: readonly EvidenceStripItem[];
  className?: string;
}

export function EvidenceStrip({ items, className }: EvidenceStripProps) {
  return (
    <div className={cn('grid gap-3', className)}>
      {items.map((item) => (
        <div
          key={`${item.title ?? 'body'}-${item.body}`}
          className="rounded-[1.1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm leading-7 text-[var(--app-copy)]"
        >
          {item.title ? (
            <div className="mb-1 text-xs tracking-[0.2em] text-[var(--app-pink-strong)]">
              {item.title}
            </div>
          ) : null}
          {item.body}
        </div>
      ))}
    </div>
  );
}
