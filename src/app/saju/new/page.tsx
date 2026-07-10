import type { Metadata } from 'next';
import SajuNewClient from './saju-new-client';

export const metadata: Metadata = {
  title: '사주풀이 시작 — 생년월일로 내 사주 보기',
  description:
    '생년월일·태어난 시간으로 보는 내 사주풀이. 궁금한 주제를 고르고 양력·음력, 출생지를 입력하면 명리 기반 해석이 바로 시작됩니다.',
  alternates: {
    canonical: '/saju/new',
  },
};

export default function Page() {
  return <SajuNewClient />;
}
