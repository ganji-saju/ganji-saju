import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { getEngineMethodEntriesBySlug } from '@/lib/engine-method-pages';

interface Props {
  title: string;
  description?: string;
  slugs: string[];
  ctaHref?: string;
  ctaLabel?: string;
  compact?: boolean;
}

export function EngineMethodLinks({
  title,
  description,
  slugs,
  ctaHref = '/method',
  ctaLabel = '읽을거리 더 보기',
  compact = false,
}: Props) {
  const entries = getEngineMethodEntriesBySlug(slugs);

  if (entries.length === 0) return null;

  return (
    <section className="app-panel p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="app-caption">풀이 읽을거리</div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--app-ivory)]">{title}</h2>
          {description ? (
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy)]">{description}</p>
          ) : null}
        </div>
        <Link
          href={ctaHref}
          className="gangi-secondary-button"
        >
          {ctaLabel}
        </Link>
      </div>

      <div className={`mt-5 grid gap-3 ${compact ? 'lg:grid-cols-3' : 'lg:grid-cols-2 xl:grid-cols-3'}`}>
        {entries.map((entry) => (
          <Link
            key={entry.slug}
            href={`/method/${entry.slug}`}
            className="rounded-[20px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] p-5 transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-[var(--app-gold)]/20 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
                {entry.eyebrow}
              </Badge>
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-[var(--app-ivory)]">{entry.title}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{entry.summary}</p>
            <div className="mt-4 text-sm font-semibold text-[var(--app-gold-text)]">이 글 읽기</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
