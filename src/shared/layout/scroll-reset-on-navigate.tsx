'use client';

// 2026-06-27 — 페이지(경로) 전환 시 항상 최상단으로 스크롤.
//   ⚠️ 만성 재발 버그: #268·#270·#391 에서 ScrollToTop 을 세 번 고쳤는데 또 재발했다.
//      근본·검증법은 memory: project_scroll-reset-on-navigate 참조(재수정 전 반드시 읽을 것).
//
//   근본원인(2026-06-27 다각 검증): 단일 원인이 아니라 "타이밍 × 전환 애니메이션" 상호작용.
//     1) template.tsx 의 page-transition 이 will-change:transform + translateY(8px→0) 애니메이션을
//        걸어, 그 프레임에서 Next 기본 scroll-to-top 이 좌표 교란/누락된다.
//     2) 이 컴포넌트가 보강하지만 useEffect 는 paint 후(1프레임 늦게) 실행돼, fade-in 도중
//        "이전 위치/푸터" 잔상이 그대로 인지됐다. ← 세 번의 수정이 다 놓친 지점.
//
//   해결: ① useLayoutEffect(paint 전 동기) 로 fade-in 첫 프레임에 top 안착,
//        ② cross-route #해시 앵커는 Next 가 해당 id 로 스크롤하므로 덮어쓰지 않음,
//        ③ behavior:'instant' 로 향후 전역 scroll-behavior:smooth 가 생겨도 밀림 방지.
//
//   쿼리스트링만 바뀌면 usePathname 불변→미트리거(탭/검색/필터의 스크롤 유지 의도 보존).
import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

// SSR 에서 useLayoutEffect 는 경고 → 클라이언트에서만 layout effect, 서버는 useEffect 로 폴백.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ScrollResetOnNavigate() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    // cross-route 해시 앵커(예: /a → /b#sec)는 Next 가 #sec 으로 스크롤하므로 존중(덮어쓰지 않음).
    if (window.location.hash) return;
    // paint 전 동기 + instant — 전환 fade 첫 프레임에 즉시 top, 잔상/푸터 노출 차단.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
