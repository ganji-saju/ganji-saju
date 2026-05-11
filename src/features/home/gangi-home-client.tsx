'use client';

import { useCallback, useEffect, useMemo, type MouseEvent } from 'react';
import { AiDialogueSection } from '@/components/home/AiDialogueSection';
import { FreeStartCards } from '@/components/home/FreeStartCards';
import { HomeHero } from '@/components/home/HomeHero';
import { PricingTeaser } from '@/components/home/PricingTeaser';
import { PrimaryFeatureCards } from '@/components/home/PrimaryFeatureCards';
import { RecentReportsSection } from '@/components/home/RecentReportsSection';
import { ThemeServiceGrid } from '@/components/home/ThemeServiceGrid';
import { TodaySnapshot, type TodaySnapshotItem } from '@/components/home/TodaySnapshot';
import type { GangiHomeBanner } from '@/content/gangi-market';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import {
  MOONLIGHT_ANALYTICS_EVENTS,
  type MoonlightAnalyticsEvent,
} from '@/lib/analytics-events';
import { AppShell } from '@/shared/layout/app-shell';

function isMoonlightAnalyticsEvent(event: string): event is MoonlightAnalyticsEvent {
  return (MOONLIGHT_ANALYTICS_EVENTS as readonly string[]).includes(event);
}

function buildHomeAnalyticsPayload(element: HTMLElement) {
  const payload: {
    source: string;
    section?: string;
    target?: string;
    featureId?: string;
    serviceId?: string;
  } = {
    source: 'home_redesign',
  };

  if (element.dataset.analyticsSection) {
    payload.section = element.dataset.analyticsSection;
  }

  if (element.dataset.analyticsTarget) {
    payload.target = element.dataset.analyticsTarget;
  }

  if (element.dataset.analyticsFeatureId) {
    payload.featureId = element.dataset.analyticsFeatureId;
  }

  if (element.dataset.analyticsServiceId) {
    payload.serviceId = element.dataset.analyticsServiceId;
  }

  return payload;
}

function buildSnapshotItems(banners: readonly GangiHomeBanner[]): readonly TodaySnapshotItem[] | undefined {
  if (!banners.length) return undefined;

  return banners.map((banner) => ({
    id: banner.id,
    label: banner.kicker,
    title: banner.title,
    description: banner.description,
    href: banner.href,
  }));
}

export function GangiHomeClient({
  initialBanners,
}: {
  initialBanners: readonly GangiHomeBanner[];
}) {
  const todaySnapshotItems = useMemo(() => buildSnapshotItems(initialBanners), [initialBanners]);

  useEffect(() => {
    trackMoonlightEvent('home_viewed', { source: 'home_redesign' });
  }, []);

  const handleTrackedClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const element = target.closest<HTMLElement>('[data-analytics-event]');
    const eventName = element?.dataset.analyticsEvent;

    if (!eventName || !isMoonlightAnalyticsEvent(eventName)) return;

    trackMoonlightEvent(eventName, buildHomeAnalyticsPayload(element));
  }, []);

  return (
    <AppShell header={<SiteHeader />} className="dalbit-market-shell">
      <div className="gangi-home home-redesign" onClick={handleTrackedClick}>
        <HomeHero />
        <TodaySnapshot items={todaySnapshotItems} />
        <PrimaryFeatureCards />
        <FreeStartCards />
        <ThemeServiceGrid />
        <AiDialogueSection />
        <RecentReportsSection />
        <PricingTeaser />
      </div>
    </AppShell>
  );
}
