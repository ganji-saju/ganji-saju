export type SystemGuideStepId =
  | 'profile'
  | 'fortune'
  | 'saju'
  | 'results'
  | 'dialogue'
  | 'notifications';

export interface SystemGuideStep {
  id: SystemGuideStepId;
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export const SYSTEM_GUIDE_STEPS: readonly SystemGuideStep[] = [
  {
    id: 'profile',
    eyebrow: '1단계',
    title: '내 정보를 등록해요',
    description: '생년월일시를 저장하면 매번 다시 입력하지 않아도 돼요.',
    primaryLabel: '내 정보 등록하기',
    primaryHref: '/my/profile',
  },
  {
    id: 'fortune',
    eyebrow: '2단계',
    title: '오늘의 운세를 확인해요',
    description: '오늘의 흐름과 일상에 적용할 수 있는 조언을 확인해요.',
    primaryLabel: '오늘의 운세 보기',
    primaryHref: '/today-fortune',
  },
  {
    id: 'saju',
    eyebrow: '3단계',
    title: '사주 분석을 시작해요',
    description: '등록한 정보를 바탕으로 나의 사주를 자세히 살펴봐요.',
    primaryLabel: '사주 분석 시작하기',
    primaryHref: '/saju/new',
  },
  {
    id: 'results',
    eyebrow: '4단계',
    title: '분석 결과를 다시 봐요',
    description: '저장된 사주와 운세 결과를 한곳에서 확인할 수 있어요.',
    primaryLabel: '내 결과 보기',
    primaryHref: '/my/results',
  },
  {
    id: 'dialogue',
    eyebrow: '5단계',
    title: '궁금한 점을 이어서 물어요',
    description: '분석 결과에서 더 알고 싶은 내용을 대화로 풀어봐요.',
    primaryLabel: '대화 시작하기',
    primaryHref: '/dialogue',
  },
  {
    id: 'notifications',
    eyebrow: '6단계',
    title: '새 소식을 놓치지 않아요',
    description: '운세와 서비스 알림을 확인하고 필요한 소식을 받아보세요.',
    primaryLabel: '알림 확인하기',
    primaryHref: '/notifications',
    secondaryLabel: '멤버십 알아보기',
    secondaryHref: '/membership',
  },
];
