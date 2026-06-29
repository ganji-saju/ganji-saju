// 2026-05-20 — 모든 페이지 우측 하단에 floating "맨 위로" 버튼.
//   AppShell 이 모든 라우트에 wrap 되므로 본 컴포넌트가 자동으로 전 페이지 노출.
//   320px 이상 스크롤 시 fade-in (페이지 진입 직후 노출 방지).
//   모바일 dock (z-40, bottom-0) 위에 자연스럽게 떠 있도록 bottom 위치 조정.
//   PC: 우하단 24px, 모바일: dock 위 (bottom-28).
//
//   PR #158 동일 이슈 — 부모 컨테이너 (motion-page-transition-frame) 의
//   transform/will-change 가 position:fixed 를 깨므로 createPortal 로 body 직접 mount.
'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { isFocusedCheckoutRoute } from '@/shared/layout/focused-checkout';

const SCROLL_THRESHOLD = 320;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  // SSR/CSR hydration mismatch 방지 — body portal 은 client-only.
  const [mounted, setMounted] = useState(false);
  // 2026-06-30 — 포커스 체크아웃(결제 화면)에서는 하단 CTA 와 겹치지 않도록 숨김.
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  if (!mounted || isFocusedCheckoutRoute(pathname)) return null;

  return createPortal(
    <button
      type="button"
      onClick={handleClick}
      aria-label="맨 위로 이동"
      data-visible={visible ? 'true' : 'false'}
      className="app-scroll-to-top"
    >
      <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />
    </button>,
    document.body
  );
}
