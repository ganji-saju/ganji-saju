'use client';

// 2026-05-16 — PR #155/#159 가 PC SiteHeader 사이드바를 가린 뒤로 PC 사용자가
// 로그아웃할 곳이 없었음. `/my/settings` 계정 관리 섹션에서 호출되는
// 단일 책임 client 컴포넌트로 추출. supabase.auth.signOut() 후 '/' 로 이동.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startNavigation] = useTransition();

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    if (hasSupabaseBrowserEnv) {
      const supabase = createClient();
      try {
        await supabase.auth.signOut();
      } catch {
        // 네트워크 실패해도 클라이언트 세션은 비우고 홈으로.
      }
    }
    startNavigation(() => {
      router.replace('/');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy}
      className="flex w-full items-center justify-between rounded-[14px] border bg-white p-3.5 text-left disabled:opacity-60"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
          {busy ? '로그아웃 중…' : '로그아웃'}
        </div>
        <div
          className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]"
          style={{ wordBreak: 'keep-all' }}
        >
          이 기기에서 로그아웃합니다. 데이터는 그대로 보관됩니다.
        </div>
      </div>
      <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
