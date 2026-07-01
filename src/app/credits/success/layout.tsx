import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '결제 완료',
  description: '전 결제 결과를 확인하는 페이지입니다.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function CreditsSuccessLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
