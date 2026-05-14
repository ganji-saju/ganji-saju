// 2026-05-14: handoff `push-modal` showcase. 모달을 트리거하는 client wrapper.
'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { PushPermissionModal } from '@/components/notifications/push-permission-modal';

export function PushModalShowcaseClient() {
  const [open, setOpen] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  return (
    <>
      <div
        className="rounded-[18px] border bg-white p-5"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          trigger
        </div>
        <h2
          className="mt-1 text-[17px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          푸시 알림 권한 모달 미리보기
        </h2>
        <p
          className="mt-1.5 text-[12.5px] leading-[1.65] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          실제 호출 흐름: <code>Notification.requestPermission</code> →{' '}
          <code>serviceWorker.register</code> → <code>pushManager.subscribe</code> →{' '}
          POST <code>/api/notifications/subscribe</code>. webPushPublicKey 미설정 환경에서는
          subscribe 단계에서 실패 응답이 돌아옵니다.
        </p>

        <button
          type="button"
          onClick={() => {
            setLastEvent(null);
            setOpen(true);
          }}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--app-pink)] px-5 text-[13.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
        >
          <Bell className="h-4 w-4" />
          모달 열기
        </button>

        {lastEvent ? (
          <div
            className="mt-3 rounded-[10px] border px-3 py-2 text-[11.5px] leading-[1.55]"
            style={{
              borderColor: 'var(--app-pink-line)',
              background: 'var(--app-pink-soft)',
              color: 'var(--app-pink-strong)',
            }}
          >
            마지막 이벤트: <code>{lastEvent}</code>
          </div>
        ) : null}
      </div>

      <PushPermissionModal
        open={open}
        onClose={() => setOpen(false)}
        onSubscribed={() => setLastEvent('subscribed')}
        onDenied={(reason) => setLastEvent(`denied · ${reason}`)}
        webPushPublicKey=""
      />
    </>
  );
}
