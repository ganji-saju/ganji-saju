// 2026-07-04 — 가입자 요약(admin_user_summary) 수동 갱신 버튼(super_admin).
// 배경: 요약이 cron 실패로 오래 stale 해도(기준 2026-06-05 고착 사례) 관리자가
// 페이지에서 바로 복구할 수단이 없었음. POST /api/admin/users/summary/refresh
// (기존 라우트 — super_admin 세션 허용) 호출 후 새로고침.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshSummaryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/users/summary/refresh', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; processed?: number; error?: string }
        | null;
      if (res.ok && data?.ok) {
        setMessage(`갱신 완료 (${data.processed ?? 0}명)`);
        router.refresh();
      } else {
        setMessage(`갱신 실패: ${data?.error ?? res.status}`);
      }
    } catch {
      setMessage('갱신 실패: 네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className="rounded-[10px] border px-3 py-1 text-[13.8px] font-bold disabled:opacity-60"
      >
        {busy ? '갱신 중…' : '지금 갱신'}
      </button>
      {message ? (
        <span className="text-[12.1px] text-[var(--app-copy-soft)]">{message}</span>
      ) : null}
    </span>
  );
}
