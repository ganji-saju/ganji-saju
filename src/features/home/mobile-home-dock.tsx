import Link from 'next/link';
import { MOBILE_QUICK_LINKS } from '@/shared/config/site-navigation';
import { cn } from '@/lib/utils';

export default function MobileHomeDock() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--app-line)] bg-[rgba(2,8,23,0.9)] px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {MOBILE_QUICK_LINKS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'rounded-2xl border px-3 py-2 text-center text-sm font-medium transition-colors',
              item.tone === 'acquisition'
                ? 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]'
                : 'border-[var(--app-gold)]/22 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
