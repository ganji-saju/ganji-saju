// 2026-05-14: handoff 보드 `push-modal` (27 · 푸시 알림 권한 모달).
// 가치 제안 → 허용 요청 → subscribe API 호출 흐름을 단일 모달로 캡슐화.
// 어떤 페이지에서든 import 해서 트리거 가능. 운영 어디서 띄울지는 caller 가 결정.
'use client';

import { useEffect, useState } from 'react';
import { Bell, Clock, MoonStar, Sparkles, X } from 'lucide-react';
// 2026-05-15 handoff PR-G3: m-modal + m-push motion 효과.
import '@/components/motion/motion-primitives.css';

const NOTIFICATION_BENEFITS = [
  {
    icon: MoonStar,
    title: '오늘운세 자동 알림',
    desc: '매일 아침 7시에 오늘 흐름을 한 줄로 받아보세요.',
  },
  {
    icon: Clock,
    title: '이번 달 결정 타이밍',
    desc: '월별 흐름이 새로 열릴 때 알려드려요.',
  },
  {
    icon: Sparkles,
    title: '풀이 업데이트',
    desc: '저장한 풀이가 갱신되면 바로 알 수 있어요.',
  },
];

interface PushPermissionModalProps {
  open: boolean;
  onClose: () => void;
  /** subscribe 성공 / 실패 결과 콜백. caller 가 분석 이벤트 / 토스트 처리. */
  onSubscribed?: () => void;
  onDenied?: (reason: 'permission-denied' | 'subscribe-failed' | 'unavailable') => void;
  /** VAPID public key. 누락 시 빈 문자열로 fallback (실제 호출 시 실패). */
  webPushPublicKey?: string;
}

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) return new Uint8Array();
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) out[i] = rawData.charCodeAt(i);
  return out;
}

export function PushPermissionModal({
  open,
  onClose,
  onSubscribed,
  onDenied,
  webPushPublicKey = '',
}: PushPermissionModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // body scroll 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  async function handleAllow() {
    setBusy(true);
    setError(null);

    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setError('이 브라우저는 알림을 지원하지 않아요.');
        onDenied?.('unavailable');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('알림 권한이 허용되지 않았어요. 설정에서 다시 허용할 수 있어요.');
        onDenied?.('permission-denied');
        return;
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('이 브라우저는 푸시 알림을 지원하지 않아요.');
        onDenied?.('unavailable');
        return;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(webPushPublicKey),
        });
      }

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? '알림 기기를 저장하지 못했어요.');
        onDenied?.('subscribe-failed');
        return;
      }

      onSubscribed?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '알림 연결에 실패했어요.');
      onDenied?.('subscribe-failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center px-3 sm:items-center"
    >
      {/* §dim — 2026-05-15 handoff 56 m-modal: backdrop fade-in */}
      <button
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
        className="motion-modal-dim absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* §sheet — 2026-05-15 handoff 56 m-modal: 모바일 슬라이드-up / 데스크탑 scale-up */}
      <article
        className="motion-modal-sheet relative w-full max-w-md overflow-hidden rounded-t-[22px] border bg-white p-5 shadow-[0_-22px_50px_-18px_rgba(17,17,20,0.32)] sm:rounded-[22px] sm:p-6"
        style={{ borderColor: 'var(--app-pink-line)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border bg-white text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <span
            className="motion-push-bell grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-white"
            style={{
              background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
              boxShadow: '0 10px 22px rgba(216,27,114,0.32)',
            }}
            aria-hidden="true"
          >
            <Bell className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              알림 받기
            </div>
            <h2
              id="push-modal-title"
              className="mt-0.5 text-[20px] font-extrabold leading-[1.35] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              매일 잠깐, 한 줄로
              <br />
              나만 받기
            </h2>
          </div>
        </div>

        <p
          className="mt-3 text-[13px] leading-[1.7] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          광고 알림은 보내지 않아요. 사주 흐름에 맞춰 하루 1번까지만 부드럽게 알려드립니다.
        </p>

        <ul className="mt-4 grid gap-2">
          {NOTIFICATION_BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <li
                key={benefit.title}
                // 2026-05-15 handoff 58 m-push: benefit card stagger entry
                className="motion-push-card flex items-start gap-3 rounded-[12px] border bg-white p-3"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
                  style={{
                    background: 'var(--app-pink-soft)',
                    color: 'var(--app-pink-strong)',
                  }}
                  aria-hidden="true"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                    {benefit.title}
                  </div>
                  <p
                    className="mt-0.5 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {benefit.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {error ? (
          <div
            className="mt-3 rounded-[10px] border px-3 py-2 text-[12px] leading-[1.55]"
            style={{
              background: '#fdecec',
              borderColor: 'rgba(198,69,69,0.22)',
              color: 'var(--app-coral)',
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={handleAllow}
            disabled={busy}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)] disabled:opacity-60"
          >
            {busy ? '연결 중...' : '알림 허용하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center rounded-full border bg-white px-5 text-[13px] font-extrabold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            다음에 받기
          </button>
        </div>

        <p
          className="mt-2 text-center text-[10.5px] leading-[1.55] text-[var(--app-copy-soft)]"
          style={{ wordBreak: 'keep-all' }}
        >
          언제든 MY → 알림 센터 → 알림 끄기 에서 끌 수 있어요.
        </p>
      </article>
    </div>
  );
}
