'use client';

// 2026-05-16 — 상단 헤더(메가 메뉴 우상단 등) 에 노출하는 아이콘 전용 로그아웃 버튼.
// `/my/settings` 의 풀폭 카드형 로그아웃과 별도 — 시각·접근 양쪽에서 빠른 진입을 제공.
// supabase.auth.signOut() 후 / 로 이동.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
// 2026-07-04 — 카카오 가입자는 카카오 SSO 세션까지 함께 종료(공용 PC 재로그인 방지).
import { signOutWithProviderCleanup } from '@/lib/auth/sign-out';

export function HeaderLogoutButton({
  className,
}: {
  className?: string;
}) {
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
      aria-label="로그아웃"
      title="로그아웃"
      className={className}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
