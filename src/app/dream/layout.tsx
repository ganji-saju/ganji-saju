// 2026-06-21 SEO(P2 Part B) — /dream 은 'use client' 페이지라 metadata 를 직접 export 할 수
// 없어, 서버 layout 에서 고유 메타데이터를 부여한다(루트 기본 title 중복 해소). 색인 대상.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '꿈해몽 — 무료 꿈해몽 사전 · 꿈풀이 검색',
  description:
    '꿈에 나온 상징을 검색해 의미를 찾아보세요. 뱀꿈·돼지꿈·이빨 빠지는 꿈 등 단어별 풀이와 상황별 해석을 제공하는 무료 꿈해몽 사전입니다.',
  alternates: { canonical: '/dream' },
};

export default function DreamLayout({ children }: { children: ReactNode }) {
  return children;
}
