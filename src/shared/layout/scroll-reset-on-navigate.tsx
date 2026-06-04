'use client';

// 2026-05-26 — 페이지(경로) 전환 시 항상 최상단으로 스크롤.
//   사용자 보고: 페이지 이동 후 스크롤이 최상단으로 가지 않고 이전 위치/푸터가 보이는 케이스.
//   Next App Router 기본 scroll-to-top 에만 의존하지 않고 명시적으로 보장한다
//   (page-transition 애니메이션·일부 브라우저 환경에서 기본 동작이 누락되는 케이스 방어).
//
//   쿼리스트링만 바뀌는 경우(탭/검색/필터 — 예: /zodiac/[slug]?period=, /search, /legal 탭)는
//   usePathname 이 불변이라 트리거되지 않아 같은 페이지 내 스크롤 위치 유지 의도를 보존한다.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollResetOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    // 즉시 top 으로(behavior:auto). 페이지 전환 fade 애니메이션과 무관하게 위치만 리셋.
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
