import Link from 'next/link';
import { ArrowRight, Moon, SunMedium } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { buttonVariants } from '@/components/ui/button';
import { HOME_SECTION_COPY } from '@/config/home/homeCopy';
import { HOME_FREE_START_CARD_IDS, HOME_SERVICE_CARDS } from '@/config/home/homeServiceCards';
import { HomeSection } from './HomeSection';

type FreeStartCardsProps = {
  className?: string;
};

const freeStartCards = HOME_SERVICE_CARDS.filter((card) =>
  HOME_FREE_START_CARD_IDS.includes(card.id as (typeof HOME_FREE_START_CARD_IDS)[number])
);

export function FreeStartCards({ className }: FreeStartCardsProps) {
  return (
    <HomeSection
      id="home-free-start"
      tone="muted"
      eyebrow={HOME_SECTION_COPY.freeStart.eyebrow}
      title={HOME_SECTION_COPY.freeStart.title}
      description={HOME_SECTION_COPY.freeStart.description}
      className={className}
    >
      <ProductGrid columns={2}>
        {freeStartCards.map((card) => {
          const Icon = card.id === 'today-fortune' ? SunMedium : Moon;

          return (
            <FeatureCard
              key={card.id}
              surface="soft"
              className="flex h-full min-h-[13.5rem] flex-col justify-between"
              icon={
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
                  <Icon className="h-5 w-5" />
                </span>
              }
              badge={<span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--app-pink-strong)] ring-1 ring-[var(--app-pink-line)]">{card.priceLabel}</span>}
              title={card.title}
              description={card.description}
              footer={
                <Link
                  href={card.href}
                  data-analytics-event={card.analyticsEvent}
                  data-analytics-section="free-start"
                  data-analytics-service-id={card.id}
                  data-analytics-target={card.id}
                  className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'min-h-12 w-full' })}
                >
                  {card.ctaLabel}
                  <ArrowRight data-icon="inline-end" className="h-4 w-4" />
                </Link>
              }
            />
          );
        })}
      </ProductGrid>
    </HomeSection>
  );
}
