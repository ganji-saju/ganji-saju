'use client';

import { useCallback, useEffect, type MouseEvent, type ReactNode } from 'react';
import { trackMoonlightEvent } from '@/lib/analytics';
import {
  MOONLIGHT_ANALYTICS_EVENTS,
  type MoonlightAnalyticsEvent,
} from '@/lib/analytics-events';

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
    source: 'home_moonlight_flow',
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

export function HomeAnalyticsBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    trackMoonlightEvent('home_viewed', { source: 'home_moonlight_flow' });
  }, []);

  const handleTrackedClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const element = target.closest<HTMLElement>('[data-analytics-event]');
    const eventName = element?.dataset.analyticsEvent;

    if (!eventName || !isMoonlightAnalyticsEvent(eventName)) return;

    trackMoonlightEvent(eventName, buildHomeAnalyticsPayload(element));
  }, []);

  return <div onClick={handleTrackedClick}>{children}</div>;
}
