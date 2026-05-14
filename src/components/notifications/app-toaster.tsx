// 2026-05-15 handoff PR-J: 57 m-toast — 토스트 인프라.
// `sonner` 의 `<Toaster>` 를 간지사주 디자인 토큰에 맞게 wrap. 위치는 모바일 하단
// (dock 위), 데스크탑 우측 하단. handoff motion-toast-stack 의 stagger 등장 패턴은
// sonner 가 자체적으로 지원.
'use client';

import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      duration={3200}
      gap={8}
      visibleToasts={3}
      // 모바일 친화: 화면 폭 95% 까지, 좁은 padding.
      // sonner 의 richColors 는 너무 강하므로 끄고 직접 토큰 적용.
      richColors={false}
      closeButton={false}
      toastOptions={{
        // motion 가속 cubic-bezier — handoff Phase 2 의 0.22, 1, 0.36, 1 일관성.
        className: 'app-toast',
        // 기본 success / error 스타일은 토큰으로 override (globals.css 의 .app-toast 분기).
      }}
      // 모션 끄기 설정 시 sonner 자체가 transition 비활성 — 별도 처리 불필요.
    />
  );
}
