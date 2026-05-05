import Link from 'next/link';
import { WISDOM_CARDS, toneClasses } from '@/content/moonlight';
import { cn } from '@/lib/utils';

interface WisdomCategoryHeroProps {
  slug: string;
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}

export function getWisdomCard(slug: string) {
  return WISDOM_CARDS.find((card) => card.slug === slug) ?? WISDOM_CARDS[0];
}

export function WisdomCategoryHero({
  slug,
  ctaHref,
  ctaLabel,
  className,
}: WisdomCategoryHeroProps) {
  const card = getWisdomCard(slug);
  const tone = toneClasses(card.tone);

  return (
    <section className={cn('wisdom-category-hero', className)} data-tone={card.tone}>
      <div className="wisdom-category-hero-content">
        <div className={cn('wisdom-category-hanja', tone.text)}>{card.hanja}</div>
        <h1 className={cn('wisdom-category-title', tone.text)}>{card.title}</h1>
        <p className="wisdom-category-hook">“{card.hook}”</p>
        <p className="wisdom-category-description">{card.description}</p>
        {ctaHref && ctaLabel ? (
          <Link href={ctaHref} className="wisdom-category-cta">
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
