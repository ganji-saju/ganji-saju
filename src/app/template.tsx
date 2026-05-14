// 2026-05-15 handoff PR-G4: 55 m-page — Next.js App Router 페이지 전환 motion.
// template.tsx 는 layout.tsx 와 달리 **navigation 마다 새로 mount** 되므로
// children 을 감싸는 wrapper 에 fade-in + 미세 lift 를 입히면 route 전환마다
// 자연스러운 transition 발생. 별도 router push prefetch overlay 없이도 동작.
//
// 본 wrapper 는 layout-neutral — 자식이 자기 layout (AppShell / AppPage 등) 그대로
// 결정. wrapper 는 `display: contents` 가 아니라 단순 block div 로, 자식의 root
// layout 흐름에 미치는 영향 0.
//
// `prefers-reduced-motion: reduce` 사용자는 정적 즉시 표시 (CSS 폴백).

import type { ReactNode } from 'react';
import '@/components/motion/motion-primitives.css';

export default function Template({ children }: { children: ReactNode }) {
  return <div className="motion-page-transition-frame">{children}</div>;
}
