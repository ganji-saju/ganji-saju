import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '비밀번호 재설정',
  description: '이메일 인증 링크로 달빛인생 계정의 새 비밀번호를 설정합니다.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ResetPasswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
