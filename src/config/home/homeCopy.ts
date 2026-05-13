import {
  PERSONALITY_COMPATIBILITY_MINI_PRICE,
  PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/personality-compatibility';
import {
  SAJU_PERSONALITY_MINI_PRICE,
  SAJU_PERSONALITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/saju-personality';

export const HOME_HERO_COPY = {
  eyebrow: '달빛인생',
  title: '오늘 무엇을 보고 싶나요?',
  lines: [
    '사주는 타고난 결을 보고,',
    '성향은 지금의 선택 습관을 보여줍니다.',
    '내 흐름을 보거나,',
    '그 사람과의 관계를 확인해보세요.',
  ],
  primaryCtaLabel: '내 성향사주 보기',
  secondaryCtaLabel: '우리 성향궁합 보기',
} as const;

export const HOME_SECTION_COPY = {
  todaySnapshot: {
    eyebrow: 'Today Snapshot',
    title: '오늘의 흐름을 먼저 가볍게 볼까요?',
    description: '오늘운세, 띠운세, 별자리 흐름을 짧게 확인하고 필요한 풀이로 이어갑니다.',
  },
  primaryFeatures: {
    eyebrow: 'New Moonlight',
    title: '사주와 성향을 함께 보는 핵심 기능',
    description: '내 흐름은 성향사주로, 두 사람의 흐름은 성향궁합으로 정리해보세요.',
  },
  freeStart: {
    eyebrow: 'Free Start',
    title: '가볍게 먼저 시작하기',
    description: '로그인 없이도 오늘운세와 타로 한 장으로 지금의 흐름을 볼 수 있습니다.',
  },
  themeServices: {
    eyebrow: 'Theme Services',
    title: '보고 싶은 주제를 골라보세요',
    description: '사주, 궁합, 올해 흐름, 좋은 날, 띠운세, 별자리까지 한 곳에서 이어집니다.',
  },
  aiDialogue: {
    eyebrow: 'AI Dialogue',
    title: '혼자 해석하기 어려운 부분은 대화로 이어가세요',
    description: '결과를 본 뒤 더 묻고 싶은 감정, 선택, 관계 흐름을 대화방에서 이어갈 수 있습니다.',
    ctaLabel: '대화방 열기',
  },
  archive: {
    eyebrow: 'Archive',
    title: '이전에 본 풀이를 다시 열어보세요',
    description: '저장된 리포트와 내 정보를 확인하고 다음 풀이로 이어갈 수 있습니다.',
    ctaLabel: '보관함 보기',
  },
  membership: {
    eyebrow: 'Membership',
    title: '더 자주 본다면 가격과 멤버십을 확인해보세요',
    description: '필요한 풀이만 볼지, 멤버십으로 이어갈지 비교할 수 있습니다.',
    pricingCtaLabel: '가격 안내 보기',
    membershipCtaLabel: '멤버십 보기',
  },
} as const;

export const HOME_PRICE_LABELS = {
  free: '무료',
  freeStart: '무료 시작',
  paidFrom550: '550원~',
  paid990: '990원',
  freePreviewWithMiniUnlock: '무료 미리보기 · 990원 깊이보기',
  inPreparation: '준비 중',
  savedReports: '저장 결과',
  pricingGuide: '가격 안내',
} as const;

export const HOME_PRODUCT_COPY = {
  sajuPersonalityMini: {
    productCode: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    name: '달빛 성향사주 깊이보기',
    price: SAJU_PERSONALITY_MINI_PRICE,
    priceLabel: HOME_PRICE_LABELS.freePreviewWithMiniUnlock,
  },
  personalityCompatibilityMini: {
    productCode: PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
    name: '달빛 성향궁합 깊이보기',
    price: PERSONALITY_COMPATIBILITY_MINI_PRICE,
    priceLabel: HOME_PRICE_LABELS.freePreviewWithMiniUnlock,
  },
} as const;
