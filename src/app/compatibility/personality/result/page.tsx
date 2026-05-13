import type { Metadata } from 'next';
import { PersonalityCompatibilityResultClient } from '@/features/compatibility/personality-compatibility-result-client';

export function generateMetadata(): Metadata {
  return {
    title: '성향궁합 무료 결과',
    description: '사주 입력값과 16유형 성향을 바탕으로 5축 점수를 보여주는 성향궁합 무료 결과 화면입니다.',
    alternates: {
      canonical: '/compatibility/personality/result',
    },
  };
}

export default function PersonalityCompatibilityResultPage() {
  return <PersonalityCompatibilityResultClient />;
}
