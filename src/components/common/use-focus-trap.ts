'use client';

// 2026-06-21 a11y(P2 Part B) — 모달 focus-trap 훅.
// role="dialog"/aria-modal/ESC/scroll-lock 는 각 모달에 이미 있으나, 키보드 포커스가
// 모달 밖 배경 요소로 빠져나가는 문제(Tab 트랩 부재)를 공통으로 해결한다.
//   active=true 시: (1) 모달 내부 첫 포커스 요소로 초기 포커스 이동,
//                   (2) Tab/Shift+Tab 순환을 모달 안에 가둠,
//                   (3) 해제(닫힘/언마운트) 시 직전 포커스 요소로 복원.
import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    // 숨겨진 요소(display:none 등) 제외 — offsetParent 가 null 이면 렌더 트리에서 제외됨.
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // (1) 초기 포커스 — 내부 첫 포커스 요소, 없으면 컨테이너 자신(tabIndex=-1 필요).
    const initial = getFocusable(container)[0] ?? container;
    initial.focus({ preventScroll: true });

    // (2) Tab 순환 트랩 — capture 단계에서 가로채 배경 탈출 차단.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = getFocusable(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      const outside = !container.contains(activeEl);

      if (event.shiftKey) {
        if (outside || activeEl === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (outside || activeEl === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // (3) 포커스 복원 — 트리거 버튼 등 직전 요소로.
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return containerRef;
}
