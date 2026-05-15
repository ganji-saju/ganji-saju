// 2026-05-16 PR #137 — URL 의 ?notif= 파라미터를 감지해 클릭 ack 전송.
// AppShell 루트에 한 번 마운트하면 모든 라우트에서 자동 동작.
//
// 동작:
// 1. 현재 URL 에 ?notif=<uuid> 가 있으면 sessionStorage 에 마크 (중복 호출 방지).
// 2. POST /api/notifications/click { id } 호출 — silent (실패 무시).
// 3. URL 에서 ?notif= 파라미터 제거 (히스토리 replaceState).
'use client';

import { useEffect } from 'react';

const SS_KEY_PREFIX = 'moonlight:notif-ack:';
const UUID_RE = /^[0-9a-f-]{36}$/i;

export function NotificationClickTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const notifId = url.searchParams.get('notif');
    if (!notifId || !UUID_RE.test(notifId)) return;

    // 중복 호출 방지 (페이지 새로고침 시).
    const ssKey = `${SS_KEY_PREFIX}${notifId}`;
    try {
      if (window.sessionStorage.getItem(ssKey)) return;
      window.sessionStorage.setItem(ssKey, '1');
    } catch {
      // sessionStorage 막혀 있어도 fetch 한 번은 시도.
    }

    // silent ack.
    void fetch('/api/notifications/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: notifId }),
      keepalive: true,
    }).catch(() => {
      // 실패 silent — 분석 목적이라 critical 아님.
    });

    // URL 정리 — ?notif= 제거.
    url.searchParams.delete('notif');
    const newUrl = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash;
    window.history.replaceState({}, '', newUrl);
  }, []);

  return null;
}
