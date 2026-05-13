import type { Metadata } from 'next';
import SajuIntakePage from '@/features/saju-intake/saju-intake-page';

export const metadata: Metadata = {
  title: '사주 시작하기',
  description: '지금 궁금한 주제를 먼저 고르고, 양력·음력, 태어난 시간, 출생지를 입력해 사주 해석으로 이어지는 시작 화면입니다.',
  alternates: {
    canonical: '/saju/new',
  },
};

export default function Page() {
  return <SajuIntakePage step="birth" />;
}
