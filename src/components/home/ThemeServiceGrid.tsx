import Link from 'next/link';
import { ArrowRight, CalendarDays, HeartHandshake, Sparkles, Star, Sun, Users } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { buttonVariants } from '@/components/ui/button';
import { HOME_SECTION_COPY } from '@/config/home/homeCopy';
import { HOME_SERVICE_CARDS, type HomeServiceCard } from '@/config/home/homeServiceCards';
import { HomeSection } from './HomeSection';

type ThemeServiceGridProps = {
  className?: string;
};

const THEME_SERVICE_IDS = [
  'saju-reading',
  'compatibility',
  'daewoon',
  'taekil',
  'zodiac',
  'star-sign',
] as const;

type ThemeServiceId = (typeof THEME_SERVICE_IDS)[number];
type ThemeServiceCard = HomeServiceCard & { id: ThemeServiceId };

const iconByServiceId: Record<ThemeServiceId, typeof Sparkles> = {
  'saju-reading': Sparkles,
  compatibility: HeartHandshake,
  daewoon: CalendarDays,
  taekil: Sun,
  zodiac: Users,
  'star-sign': Star,
};

export function ThemeServiceGrid({ className }: ThemeServiceGridProps) {
  const cards = HOME_SERVICE_CARDS.filter((card) =>
    THEME_SERVICE_IDS.includes(card.id as ThemeServiceId)
  ) as readonly ThemeServiceCard[];

  return (
    <HomeSection
      id="home-theme-services"
      tone="panel"
      eyebrow={HOME_SECTION_COPY.themeServices.eyebrow}
      title={HOME_SECTION_COPY.themeServices.title}
      description={HOME_SECTION_COPY.themeServices.description}
      className={className}
    >
      <ProductGrid columns={3}>
        {cards.map((card) => {
          const Icon = iconByServiceId[card.id];

          return (
            <FeatureCard
              key={card.id}
              surface="soft"
              className="flex h-full min-h-[15rem] flex-col justify-between"
              icon={
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--app-surface-muted)] text-[var(--app-pink-strong)]">
                  <Icon className="h-5 w-5" />
                </span>
              }
              badge={<span className="text-xs font-bold text-[var(--app-copy-muted)]">{card.priceLabel}</span>}
              title={card.title}
              description={card.description}
              footer={
                <Link
                  href={card.href}
                  data-analytics-event={card.analyticsEvent}
                  data-analytics-section="theme-services"
                  data-analytics-service-id={card.id}
                  data-analytics-target={card.id}
                  className={buttonVariants({ variant: 'outline', size: 'lg', className: 'min-h-12 w-full' })}
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
