import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '로그인',
  description: '카카오 또는 Google 계정으로 로그인하고 무료 전을 받아 사주 서비스를 이용하세요.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
