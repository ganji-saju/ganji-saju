// 2026-07-04 — 자체 방문(유입) 카운트 핑. 루트 레이아웃에 1회 마운트.
// localStorage 익명 vid + KST 일 1회 게이트 → POST /api/visit (sendBeacon 우선).
// 광고차단기/JS 미실행 방문은 안 잡힘 — admin 지표는 "하한치"로 표기.
// 2026-07-07 — 유입 캠페인 분석용 UTM 수집 추가. 방문 핑은 하루 1회지만, UTM 이 있는
//   랜딩(광고 클릭)은 별도 게이트로 하루 1회 더 허용 — 당일 direct 후 광고 클릭도 귀속.
'use client';

import { useEffect } from 'react';

const VID_KEY = 'moonlight:vid';
const GATE_PREFIX = 'moonlight:visit-ping:';
const UTM_GATE_PREFIX = 'moonlight:visit-utm:';

function kstDateKey(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

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

export function VisitPing() {
  useEffect(() => {
    try {
      const dateKey = kstDateKey();
      const gateKey = `${GATE_PREFIX}${dateKey}`;
      const utmGateKey = `${UTM_GATE_PREFIX}${dateKey}`;
      const dailyPinged = Boolean(window.localStorage.getItem(gateKey));
      const utm = readUtm();
      const hasUtm = Boolean(utm.utm_source || utm.utm_medium || utm.utm_campaign);
      const utmPinged = Boolean(window.localStorage.getItem(utmGateKey));

      // 오늘 방문 핑을 했고, UTM 이 없거나 이미 UTM 핑도 했으면 skip.
      if (dailyPinged && (!hasUtm || utmPinged)) return;

      let vid = window.localStorage.getItem(VID_KEY);
      if (!vid) {
        vid = crypto.randomUUID();
        window.localStorage.setItem(VID_KEY, vid);
      }

      const payload = JSON.stringify({
        vid,
        path: window.location.pathname,
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

      window.localStorage.setItem(gateKey, '1');
      if (hasUtm) window.localStorage.setItem(utmGateKey, '1');
      // 지난 날짜 게이트 정리(축적 방지) — 방문·UTM 게이트 모두.
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        const isGate = key.startsWith(GATE_PREFIX) || key.startsWith(UTM_GATE_PREFIX);
        if (isGate && key !== gateKey && key !== utmGateKey) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // 저장소 접근 불가(시크릿 모드 제한 등) — 무시.
    }
  }, []);

  return null;
}
