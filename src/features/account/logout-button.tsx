'use client';

// 2026-05-16 — PR #155/#159 가 PC SiteHeader 사이드바를 가린 뒤로 PC 사용자가
// 로그아웃할 곳이 없었음. `/my/settings` 계정 관리 섹션에서 호출되는
// 단일 책임 client 컴포넌트로 추출. supabase.auth.signOut() 후 '/' 로 이동.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// 2026-07-04 — 카카오 가입자는 카카오 SSO 세션까지 함께 종료(공용 PC 재로그인 방지).
import { signOutWithProviderCleanup } from '@/lib/auth/sign-out';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startNavigation] = useTransition();

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    const result = await signOutWithProviderCleanup();
    if (result === 'kakao-redirect') return; // 풀 내비게이션 진행 중 — 라우팅 불필요.
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
        <div className="text-[15.5px] font-extrabold text-[var(--app-ink)]">
          {busy ? '로그아웃 중…' : '로그아웃'}
        </div>
        <div
          className="mt-0.5 text-[13.2px] text-[var(--app-copy-soft)]"
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
