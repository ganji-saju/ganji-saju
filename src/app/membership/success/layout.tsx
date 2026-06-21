// 2026-06-21 SEO(P2 Part B) — /membership/success 는 'use client' 결제 콜백 페이지.
// 결제 결과 화면이라 색인 비대상(noindex) — 얇은/개인 콘텐츠 색인 방지.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '결제 완료',
  robots: { index: false, follow: false },
};

export default function MembershipSuccessLayout({ children }: { children: ReactNode }) {
  return children;
}
