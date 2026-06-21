// 2026-06-21 SEO(P2 Part B) — /dialogue/appointment 는 'use client' 예약 흐름 페이지.
// 고유 title 부여 + 개인 예약 흐름이라 색인 비대상(noindex).
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '상담 예약',
  description: '달빛 선생님과의 1:1 상담을 예약하세요.',
  robots: { index: false, follow: false },
};

export default function AppointmentLayout({ children }: { children: ReactNode }) {
  return children;
}
