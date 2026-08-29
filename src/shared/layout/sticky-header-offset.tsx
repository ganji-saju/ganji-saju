'use client';
// 2026-08-29 — 스티키 서브헤더(뒤로가기+제목)가 상단 메뉴 밑으로 파고들어 반쯤 잘리던 문제.
//
//   기존엔 `top: 3.25rem` 로 헤더 높이를 상수로 박아뒀다. 그 값은 app-shell.css 의
//   `min-height: 3.25rem` 을 보고 쓴 건데, 나중에 readability.css 가 헤더를 3.95rem 으로
//   키우면서 이 상수는 따라가지 않았다 — 실측 헤더 높이는 64/69/77px(모바일/태블릿/PC).
//   게다가 '읽기 크기' 설정이 루트 폰트를 바꾸면 헤더 높이도 같이 변한다. 상수로는 못 맞춘다.
//
//   그래서 실제 높이를 재서 --app-header-height 로 흘린다. 스티키 오프셋을 쓰는 쪽
//   (.gangi-sub-header, .gangi-saju-subtabs)이 이 변수를 참조하면 헤더를 따라간다.
import { useEffect } from 'react';

const HEADER_SELECTORS = ['.mega-nav-root', '.app-top-header'];

export function StickyHeaderOffset() {
  useEffect(() => {
    const apply = () => {
      // PC 는 mega-nav, 모바일/태블릿은 app-top-header — 보이는 쪽 하나만 쓴다.
      const visible = HEADER_SELECTORS.map((sel) =>
        document.querySelector<HTMLElement>(sel),
      ).find((el) => el && el.offsetHeight > 0);
      // offsetHeight 는 정수로 반올림돼 0.x px 만큼 헤더 밑에 파고든다 — rect 로 소수까지.
      document.documentElement.style.setProperty(
        '--app-header-height',
        `${visible ? visible.getBoundingClientRect().height : 0}px`,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    for (const sel of HEADER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) observer.observe(el);
    }
    window.addEventListener('resize', apply);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, []);
  return null;
}
