import type { Metadata } from 'next';
import { PersonalityCompatibilityInputClient } from '@/features/compatibility/personality-compatibility-input-client';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '성향궁합 입력',
    description: '사주와 16유형 성향을 함께 입력해 관계 질문을 준비하는 성향궁합 입력 화면입니다.',
    alternates: { canonical: '/compatibility/personality' },
  };
}

export default function PersonalityCompatibilityPage() {
  return <PersonalityCompatibilityInputClient />;
}
