import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '전 잔액',
  description: '보유한 전 잔액과 사용 안내를 확인하세요. 전 충전은 종료되었습니다.',
  alternates: {
    canonical: '/credits',
  },
};

export default function CreditsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
