import type { Metadata } from 'next';
import { SajuPersonalityResultHandoffClient } from '@/features/saju-personality/saju-personality-result-handoff-client';

export const metadata: Metadata = {
  title: '달빛 성향사주 무료 결과',
  description: '달빛 성향사주 입력값을 바탕으로 무료 결과 생성 단계로 이어지는 화면입니다.',
  alternates: {
    canonical: '/saju/personality/result',
  },
};

export default function SajuPersonalityResultPage() {
  return <SajuPersonalityResultHandoffClient />;
}
