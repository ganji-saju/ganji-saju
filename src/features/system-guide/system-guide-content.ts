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
    title: '내 정보를 먼저 등록해 보세요',
    description: '생년월일과 태어난 시간을 저장하면 모든 풀이가 내 정보에 맞춰집니다.',
    primaryLabel: '내 정보 등록하기',
    primaryHref: '/my/profile',
  },
  {
    id: 'fortune',
    eyebrow: '2단계',
    title: '오늘 흐름부터 가볍게 보세요',
    description: '오늘운세·타로·띠운세·별자리로 오늘 흐름부터 무료로 확인하세요.',
    primaryLabel: '오늘운세 보기',
    primaryHref: '/today-fortune',
  },
  {
    id: 'saju',
    eyebrow: '3단계',
    title: '내 사주풀이를 만들어 보세요',
    description: '한 번 입력한 정보로 기본 풀이부터 깊은 풀이까지 이어서 볼 수 있어요.',
    primaryLabel: '사주풀이 시작',
    primaryHref: '/saju/new',
  },
  {
    id: 'results',
    eyebrow: '4단계',
    title: '풀이를 저장하고 다시 확인하세요',
    description: '저장한 풀이와 결제한 콘텐츠는 보관함에서 다시 열어볼 수 있어요.',
    primaryLabel: '보관함 보기',
    primaryHref: '/my/results',
  },
  {
    id: 'dialogue',
    eyebrow: '5단계',
    title: '궁금한 내용을 선생님께 물어보세요',
    description: '주제별 선생님에게 질문하고 이전 대화도 다시 확인할 수 있어요.',
    primaryLabel: '대화 시작',
    primaryHref: '/dialogue',
  },
  {
    id: 'notifications',
    eyebrow: '6단계',
    title: '알림과 이용내역을 한곳에서 관리하세요',
    description: '푸시·카카오·이메일 알림과 멤버십·결제내역을 한곳에서 관리하세요.',
    primaryLabel: '알림 설정',
    primaryHref: '/notifications',
    secondaryLabel: '멤버십 보기',
    secondaryHref: '/membership',
  },
];
