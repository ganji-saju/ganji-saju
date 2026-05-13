import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '코인 센터',
  description: '분야별 깊이보기와 보너스 코인팩에 사용할 코인 상품을 확인하고 결제하세요.',
  alternates: {
    canonical: '/credits',
  },
};

export default function CreditsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
