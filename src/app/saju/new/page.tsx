import type { Metadata } from 'next';
import SajuIntakePage from '@/features/saju-intake/saju-intake-page';
import { buildOpenGraph, buildTwitter } from '@/lib/site';

const PAGE_TITLE = '사주 시작하기';
const PAGE_DESC = '지금 궁금한 주제를 먼저 고르고, 양력·음력, 태어난 시간, 출생지를 입력해 사주 해석으로 이어지는 시작 화면입니다.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: '/saju/new' },
  openGraph: buildOpenGraph({ title: PAGE_TITLE, description: PAGE_DESC, path: '/saju/new' }),
  twitter: buildTwitter({ title: PAGE_TITLE, description: PAGE_DESC }),
};

export default function Page() {
  return <SajuIntakePage step="birth" />;
}
