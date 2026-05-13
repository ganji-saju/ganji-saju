import Link from 'next/link';
import { ArrowRight, WalletCards } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { buttonVariants } from '@/components/ui/button';
import { HOME_SECTION_COPY } from '@/config/home/homeCopy';
import { HOME_ROUTES } from '@/config/home/homeNavigation';
import { HomeSection } from './HomeSection';

type PricingTeaserProps = {
  className?: string;
};

export function PricingTeaser({ className }: PricingTeaserProps) {
  return (
    <HomeSection
      id="home-pricing"
      tone="panel"
      className={className}
      contentClassName="mt-0"
    >
      <FeatureCard
        surface="muted"
        className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
        icon={
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--app-pink)] text-white">
            <WalletCards className="h-6 w-6" />
          </span>
        }
        eyebrow={HOME_SECTION_COPY.membership.eyebrow}
        title={HOME_SECTION_COPY.membership.title}
        description={HOME_SECTION_COPY.membership.description}
        footer={
          <div className="grid gap-3 sm:flex sm:flex-wrap md:justify-end">
            <Link
              href={HOME_ROUTES.pricing}
              data-analytics-event="home_pricing_clicked"
              data-analytics-section="pricing"
              data-analytics-service-id="pricing"
              data-analytics-target="pricing"
              className={buttonVariants({ size: 'lg', className: 'min-h-12 w-full sm:w-auto' })}
            >
              {HOME_SECTION_COPY.membership.pricingCtaLabel}
              <ArrowRight data-icon="inline-end" className="h-4 w-4" />
            </Link>
            <Link
              href={HOME_ROUTES.membership}
              data-analytics-event="home_pricing_clicked"
              data-analytics-section="pricing"
              data-analytics-service-id="membership"
              data-analytics-target="membership"
              className={buttonVariants({
                variant: 'secondary',
                size: 'lg',
                className: 'min-h-12 w-full sm:w-auto',
              })}
            >
              {HOME_SECTION_COPY.membership.membershipCtaLabel}
            </Link>
          </div>
        }
      />
    </HomeSection>
  );
}
