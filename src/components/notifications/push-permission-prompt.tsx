// 2026-05-15 handoff PR-G3: 58 m-push + push-modal 보드 production mount.
// audit 결과 PushPermissionModal 이 production 어디서도 mount 안 됨 (SHELL).
// 이 client wrapper 가 다음 조건 모두 충족 시 모달을 자동 prompt:
//   1) Notification API + serviceWorker + PushManager 지원
//   2) Notification.permission === 'default' (아직 묻지 않음)
//   3) localStorage `moonlight:push-modal:dismissed-at` 가 없거나 7일 경과
// caller 는 위치만 정함 (today-fortune-result-client 등) — trigger 정책은 본 컴포넌트가.
'use client';

import { useEffect, useState } from 'react';
import { PushPermissionModal } from '@/components/notifications/push-permission-modal';

interface PushPermissionPromptProps {
  /** 페이지 mount 후 모달을 띄울 때까지 대기 시간 (ms). 기본 20초. */
  delayMs?: number;
  /** dismiss 후 다음 노출까지 cooldown (일). 기본 7일. */
  cooldownDays?: number;
  /** VAPID public key (env 또는 caller 가 전달). 없으면 noop. */
  webPushPublicKey?: string;
}

const STORAGE_KEY = 'moonlight:push-modal:dismissed-at';

function getDismissedAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function setDismissedNow() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // private mode 등 storage 차단 — silent.
  }
}

export function PushPermissionPrompt({
  delayMs = 20_000,
  cooldownDays = 7,
  webPushPublicKey = '',
}: PushPermissionPromptProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 브라우저 capability 검사
    if (typeof Notification === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'default') return;

    // cooldown 검사
    const dismissedAt = getDismissedAt();
    if (dismissedAt !== null) {
      const elapsedMs = Date.now() - dismissedAt;
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      if (elapsedMs < cooldownMs) return;
    }

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, cooldownDays]);

  function handleClose() {
    setOpen(false);
    setDismissedNow();
  }

  function handleSubscribed() {
    setOpen(false);
    // 구독 성공 시 cooldown 도 기록 — 같은 사용자가 다른 기기 진입 시 재노출 방지.
    setDismissedNow();
  }

  function handleDenied(_reason: 'permission-denied' | 'subscribe-failed' | 'unavailable') {
    setOpen(false);
    setDismissedNow();
  }

  return (
    <PushPermissionModal
      open={open}
      onClose={handleClose}
      onSubscribed={handleSubscribed}
      onDenied={handleDenied}
      webPushPublicKey={webPushPublicKey}
    />
  );
}
