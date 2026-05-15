'use client';

// 2026-05-16 — 상단 헤더(메가 메뉴 우상단 등) 에 노출하는 아이콘 전용 로그아웃 버튼.
// `/my/settings` 의 풀폭 카드형 로그아웃과 별도 — 시각·접근 양쪽에서 빠른 진입을 제공.
// supabase.auth.signOut() 후 / 로 이동.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';

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
      aria-label="로그아웃"
      title="로그아웃"
      className={className}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
