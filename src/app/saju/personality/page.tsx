import type { Metadata } from 'next';
import { SajuPersonalityInputClient } from '@/features/saju-personality/saju-personality-input-client';

export const metadata: Metadata = {
  title: '달빛 성향사주 입력',
  description: '개인 사주와 16유형 성향 또는 성향 체크를 함께 입력해 달빛 성향사주 무료 결과를 준비합니다.',
  alternates: {
    canonical: '/saju/personality',
  },
};

export default function SajuPersonalityPage() {
  return <SajuPersonalityInputClient />;
}
