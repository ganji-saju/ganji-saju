import type { Metadata } from 'next';
import { buildOpenGraph, buildTwitter } from '@/lib/site';

const PAGE_TITLE = '코인 센터';
const PAGE_DESC = '분야별 깊이보기와 보너스 코인팩에 사용할 코인 상품을 확인하고 결제하세요.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: '/credits' },
  openGraph: buildOpenGraph({ title: PAGE_TITLE, description: PAGE_DESC, path: '/credits' }),
  twitter: buildTwitter({ title: PAGE_TITLE, description: PAGE_DESC }),
};

export default function CreditsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
