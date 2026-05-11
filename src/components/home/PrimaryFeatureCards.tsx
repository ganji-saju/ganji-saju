import Link from 'next/link';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { buttonVariants } from '@/components/ui/button';
import { HOME_FEATURE_CARDS } from '@/config/home/homeFeatureCards';
import { HOME_SECTION_COPY } from '@/config/home/homeCopy';
import { cn } from '@/lib/utils';
import { HomeSection } from './HomeSection';

type PrimaryFeatureCardsProps = {
  className?: string;
};

export function PrimaryFeatureCards({ className }: PrimaryFeatureCardsProps) {
  return (
    <HomeSection
      id="home-primary-features"
      tone="panel"
      eyebrow={HOME_SECTION_COPY.primaryFeatures.eyebrow}
      title={HOME_SECTION_COPY.primaryFeatures.title}
      description={HOME_SECTION_COPY.primaryFeatures.description}
      className={className}
      contentClassName="mt-4 md:mt-5"
    >
      <ProductGrid columns={2}>
        {HOME_FEATURE_CARDS.map((card) => (
          <FeatureCard
            key={card.id}
            surface={card.badge === 'NEW' ? 'panel' : 'muted'}
            className="flex h-full min-h-[14.5rem] flex-col justify-between md:min-h-[18rem]"
            badge={
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-extrabold tracking-[0.14em]',
                  card.badge === 'NEW'
                    ? 'bg-[var(--app-ink)] text-white'
                    : 'bg-[var(--app-pink)] text-white'
                )}
              >
                {card.badge}
              </span>
            }
            icon={
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
                <BadgeCheck className="h-5 w-5" />
              </span>
            }
            title={card.title}
            description={card.description}
            footer={
              <div className="grid gap-4">
                <p className="text-sm font-bold text-[var(--app-pink-strong)]">{card.priceLabel}</p>
                <Link
                  href={card.href}
                  data-analytics-event={card.analyticsEvent}
                  data-analytics-section="primary-features"
                  data-analytics-feature-id={card.id}
                  data-analytics-target={card.id}
                  className={buttonVariants({ size: 'lg', className: 'min-h-12 w-full' })}
                >
                  {card.ctaLabel}
                  <ArrowRight data-icon="inline-end" className="h-4 w-4" />
                </Link>
              </div>
            }
          />
        ))}
      </ProductGrid>
    </HomeSection>
  );
}
