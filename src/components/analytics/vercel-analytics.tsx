'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { redactResultLinkUrl } from './ga-sanitize';

// 2026-10-21 — 랜딩 주문 결과 링크(/r/<토큰>)의 토큰은 열람 열쇠다. Vercel 수집에도 가린 주소만 보낸다.
export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: redactResultLinkUrl(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: redactResultLinkUrl(event.url) })} />
    </>
  );
}
