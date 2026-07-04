// 2026-07-04 SEO — 인증 퍼널 noindex(login/layout.tsx 와 동일 정책).
// robots.txt disallow 만으로는 외부 링크 유입 시 색인될 수 있어 meta 로 이중 방어.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '회원가입',
  description: '간지사주 회원가입 — 이메일 또는 카카오·Google 계정으로 시작하세요.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SignupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
