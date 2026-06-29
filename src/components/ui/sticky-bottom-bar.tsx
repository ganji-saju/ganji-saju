// 2026-06-30 — 화면 하단 고정 바(결제 CTA·예약·삭제·비번재설정·궁합 등 공용).
//   부모 컨테이너(motion-page-transition-frame / app-shell-content)의 transform·
//   will-change 가 position:fixed 의 containing block 을 가로채므로, 그냥 `fixed` 를
//   쓰면 뷰포트가 아니라 콘텐츠 끝에 붙는다(맨 위에선 안 보임). → 모바일 dock / "맨 위로"
//   FAB 과 동일하게 createPortal 로 document.body 에 직접 mount 해서 진짜 viewport 고정.
//   (자세한 배경: 메모리 project_fixed-cta-needs-body-portal)
'use client';

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// useLayoutEffect 은 SSR 에서 경고 → 클라이언트에서만 사용.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface Props {
  children: ReactNode;
  /**
   * 'above-dock'(기본): 모바일 하단 dock 바로 위에 고정(dock 이 보이는 일반 페이지).
   * 'bottom': 화면 맨 아래 고정(결제 등 dock 을 숨기는 포커스 라우트).
   */
  variant?: 'above-dock' | 'bottom';
  /** 바깥 fixed 바 추가 클래스(예: 'md:hidden'). */
  className?: string;
  /** 안쪽 max-width 컨테이너 추가 클래스(예: 'flex gap-2'). */
  innerClassName?: string;
}

export function StickyBottomBar({
  children,
  variant = 'above-dock',
  className,
  innerClassName,
}: Props) {
  // SSR/CSR hydration mismatch 방지 — body portal 은 client-only.
  const [mounted, setMounted] = useState(false);
  // dock 실측 높이(px). null=측정 전. 0=dock 없음/숨김(데스크탑).
  const [dockHeight, setDockHeight] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!mounted || variant !== 'above-dock') return;
    const measure = () => {
      const dock = document.querySelector('.app-mobile-dock');
      // dock 아직 mount 전이면 fallback(token) 유지 — 절대 겹치지 않게.
      if (!dock) return;
      const visible = getComputedStyle(dock).display !== 'none';
      setDockHeight(visible ? Math.round(dock.getBoundingClientRect().height) : 0);
    };
    measure();
    // dock 은 자체 effect 로 늦게 portal mount → 다음 프레임 재측정.
    const raf = requestAnimationFrame(measure);
    const dock = document.querySelector('.app-mobile-dock');
    const ro =
      typeof ResizeObserver !== 'undefined' && dock ? new ResizeObserver(measure) : null;
    if (ro && dock) ro.observe(dock);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mounted, variant]);

  if (!mounted) return null;

  const aboveDock = variant === 'above-dock';
  const bottom = !aboveDock
    ? 0
    : dockHeight == null
      ? 'var(--app-mobile-dock-clearance)' // 측정 전: dock 보다 항상 위(겹침 방지)
      : `${dockHeight}px`;

  return createPortal(
    <div
      className={cn(
        'fixed inset-x-0 z-40 border-t border-[var(--app-line)] bg-white/95 px-4 py-3.5 backdrop-blur',
        className
      )}
      style={{
        bottom,
        // above-dock: dock 이 하단 safe-area 를 처리하므로 바 자체엔 추가 불필요.
        // bottom: dock 없음 → safe-area 직접 확보.
        paddingBottom: aboveDock ? '14px' : 'calc(14px + env(safe-area-inset-bottom))',
      }}
    >
      <div className={cn('mx-auto w-full max-w-[28rem]', innerClassName)}>{children}</div>
    </div>,
    document.body
  );
}
