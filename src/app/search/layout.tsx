// 2026-06-21 SEO(P2 Part B) — /search 는 'use client' 페이지. 고유 title 부여 + 검색 결과
// 페이지는 색인 비대상(noindex)으로 둔다(얇은/중복 콘텐츠 색인 방지).
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '검색',
  description: '사주·타로·꿈해몽·운세를 한 번에 검색하세요.',
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
