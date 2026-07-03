// 2026-07-04 — 자체 방문(유입) 카운트 핑. 루트 레이아웃에 1회 마운트.
// localStorage 익명 vid + KST 일 1회 게이트 → POST /api/visit (sendBeacon 우선).
// 광고차단기/JS 미실행 방문은 안 잡힘 — admin 지표는 "하한치"로 표기.
'use client';

import { useEffect } from 'react';

const VID_KEY = 'moonlight:vid';
const GATE_PREFIX = 'moonlight:visit-ping:';

function kstDateKey(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function VisitPing() {
  useEffect(() => {
    try {
      const dateKey = kstDateKey();
      const gateKey = `${GATE_PREFIX}${dateKey}`;
      if (window.localStorage.getItem(gateKey)) return;

      let vid = window.localStorage.getItem(VID_KEY);
      if (!vid) {
        vid = crypto.randomUUID();
        window.localStorage.setItem(VID_KEY, vid);
      }

      const payload = JSON.stringify({
        vid,
        path: window.location.pathname,
        ref: document.referrer || null,
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
      // 지난 날짜 게이트 정리(축적 방지).
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(GATE_PREFIX) && key !== gateKey) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // 저장소 접근 불가(시크릿 모드 제한 등) — 무시.
    }
  }, []);

  return null;
}
