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
  /**
   * 2026-07-20 — 'scroll-down': **아래로 스크롤할 때만** 노출(사용자 요청).
   *   결제 CTA 처럼 화면을 계속 차지하면 답답한 바에만 opt-in 으로 쓴다.
   *   기본(미지정)은 항상 노출 — 체크아웃·예약·계정삭제 같은 "지금 해야 하는" 바는
   *   숨으면 안 되므로 동작을 바꾸지 않는다.
   */
  revealOn?: 'always' | 'scroll-down';
}

export function StickyBottomBar({
  children,
  variant = 'above-dock',
  className,
  innerClassName,
  revealOn = 'always',
}: Props) {
  // SSR/CSR hydration mismatch 방지 — body portal 은 client-only.
  const [mounted, setMounted] = useState(false);
  // dock 실측 높이(px). null=측정 전. 0=dock 없음/숨김(데스크탑).
  const [dockHeight, setDockHeight] = useState<number | null>(null);
  // revealOn='scroll-down' 일 때만 쓰인다. 최상단에서는 숨김에서 시작.
  const [revealed, setRevealed] = useState(revealOn === 'always');

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

  // 아래로 스크롤 → 노출 / 위로 스크롤·최상단 → 숨김.
  //   ⚠️ 방향만 보면 손가락 미세 떨림에 깜빡인다 → 8px 임계값으로 무시한다.
  //   최상단 근처(<120px)에서는 무조건 숨김 — 인라인 카드가 아직 화면에 있어 중복이다.
  useEffect(() => {
    if (!mounted || revealOn !== 'scroll-down') return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < 8) return;
      lastY = y;
      setRevealed(y > 120 && delta > 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mounted, revealOn]);

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
        // 숨김은 unmount 가 아니라 transform — 나타날 때 레이아웃이 튀지 않는다.
        transform: revealed ? 'translateY(0)' : 'translateY(120%)',
        transition: 'transform 220ms ease',
        visibility: revealed ? 'visible' : 'hidden',
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
