// 2026-05-15 handoff PR-F: 62 m-chart — production 연결.
// FiveElementOrbitChart 가 server component 이므로 IntersectionObserver 기반
// reveal 트리거를 외부 client wrapper 로 분리. 차트 자체는 markup 그대로 두고
// 부모의 data-revealed attribute 토글에 따라 자식 SVG polygon · DOM node 가
// fade/scale 로 등장한다. caller layout 영향 없는 transparent wrapper.
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ChartDrawReveal({
  children,
  /** viewport 진입 임계 (0~1). 기본 0.2 = 차트의 20% 가 보이면 트리거. */
  threshold = 0.2,
  className,
}: {
  children: ReactNode;
  threshold?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // SSR 시에는 false 로 렌더 → hydration 후 IntersectionObserver 가 트리거.
  // prefers-reduced-motion 사용자는 즉시 true 로 셋팅 (motion 없이 정적 표시).
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 모션 끄기 설정 사용자는 즉시 reveal.
    const reducedQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (reducedQuery?.matches) {
      setRevealed(true);
      return;
    }

    // IntersectionObserver 미지원 환경 → 즉시 reveal (안전 폴백).
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={`chart-draw-reveal${className ? ` ${className}` : ''}`}
      data-revealed={revealed}
    >
      {children}
    </div>
  );
}
