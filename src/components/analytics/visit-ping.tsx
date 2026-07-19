// 2026-07-04 — 자체 방문(유입) 카운트 핑.
// 2026-07-10 — GA/Vercel 비교 정확도를 위해 라우트 변경마다 page_view 를 전송한다.
// visitor 는 서버에서 KST 일별 1명으로 dedupe, page_views 는 매 전송마다 증가.
// 광고차단기/JS 미실행 방문은 안 잡힘 — admin 지표는 "자체 수집 기준"으로 표기.
// 2026-07-07 — 유입 캠페인 분석용 UTM 수집 추가. 서버는 당일 첫 UTM 을 보존한다.
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { shouldSkipVisitAnalytics } from '@/lib/analytics/visit-filters';
import { sanitizePath, sanitizeQuery } from './ga-sanitize';

const VID_KEY = 'moonlight:vid';
const GATE_PREFIX = 'moonlight:visit-ping:';
const UTM_GATE_PREFIX = 'moonlight:visit-utm:';
const PUBLIC_VERCEL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV ?? '';

function readUtm(): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
} {
  try {
    const p = new URLSearchParams(window.location.search);
    const pick = (k: string) => {
      const v = p.get(k)?.trim();
      return v ? v.slice(0, 120) : null;
    };
    return {
      utm_source: pick('utm_source'),
      utm_medium: pick('utm_medium'),
      utm_campaign: pick('utm_campaign'),
    };
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null };
  }
}

function cleanupLegacyGateKeys() {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(GATE_PREFIX) || key.startsWith(UTM_GATE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // 저장소 접근 불가(시크릿 모드 제한 등) — 무시.
  }
}

export function VisitPing() {
  const pathname = usePathname();
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const skipReason = shouldSkipVisitAnalytics({
        path: pathname,
        host: window.location.host,
        deploymentEnv: PUBLIC_VERCEL_ENV,
      });
      if (skipReason) return;

      const safePath = sanitizePath(pathname) + sanitizeQuery(window.location.search);
      if (lastSentRef.current === safePath) return;
      lastSentRef.current = safePath;

      const utm = readUtm();
      let vid = window.localStorage.getItem(VID_KEY);
      if (!vid) {
        vid = crypto.randomUUID();
        window.localStorage.setItem(VID_KEY, vid);
      }

      const payload = JSON.stringify({
        event: 'page_view',
        vid,
        path: safePath,
        ref: document.referrer || null,
        ...utm,
      });

      // sendBeacon: 페이지 이탈에도 전송 보장. 미지원/실패 시 fetch keepalive 폴백.
      const sent = navigator.sendBeacon?.(
        '/api/visit',
        new Blob([payload], { type: 'application/json' })
      );
      if (!sent) {
        void fetch('/api/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }

      cleanupLegacyGateKeys();
    } catch {
      // 저장소 접근 불가(시크릿 모드 제한 등) — 무시.
    }
  }, [pathname]);

  return null;
}
