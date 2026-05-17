'use client';

import Link, { type LinkProps } from 'next/link';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { MoonlightAnalyticsEvent } from '@/lib/analytics-events';

type TrackedLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  // 2026-05-17 PR #207 — sample-report redesign 등에서 inline design token style 사용.
  style?: CSSProperties;
  eventName: MoonlightAnalyticsEvent;
  eventParams?: Record<string, unknown>;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function TrackedLink({
  children,
  eventName,
  eventParams,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          trackMoonlightEvent(eventName, eventParams);
        }
      }}
    >
      {children}
    </Link>
  );
}
