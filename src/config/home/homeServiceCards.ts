import type { MoonlightAnalyticsEvent } from '@/lib/analytics-events';
import { HOME_PRICE_LABELS } from './homeCopy';
import { HOME_ROUTES } from './homeNavigation';

export type HomeServiceCardCategory =
  | 'free-start'
  | 'saju'
  | 'compatibility'
  | 'fortune'
  | 'consult'
  | 'archive'
  | 'pricing';

export type HomeServiceCard = {
  id:
    | 'today-fortune'
    | 'tarot-daily'
    | 'saju-reading'
    | 'compatibility'
    | 'daewoon'
    | 'taekil'
    | 'zodiac'
    | 'star-sign'
    | 'dialogue'
    | 'archive'
    | 'pricing';
  title: string;
  description: string;
  priceLabel: string;
  ctaLabel: string;
  href: string;
  category: HomeServiceCardCategory;
  analyticsEvent: MoonlightAnalyticsEvent;
};

export const HOME_SERVICE_CARDS = [
  {
    id: 'today-fortune',
    title: '오늘운세',
    description: '오늘의 핵심 흐름을 짧게 확인합니다.',
    priceLabel: HOME_PRICE_LABELS.free,
    ctaLabel: '오늘운세 보기',
    href: HOME_ROUTES.todayFortune,
    category: 'free-start',
    analyticsEvent: 'home_free_service_clicked',
  },
  {
    id: 'tarot-daily',
    title: '타로 한 장',
    description: '마음이 끌리는 카드로 지금의 힌트를 봅니다.',
    priceLabel: HOME_PRICE_LABELS.free,
    ctaLabel: '타로 뽑기',
    href: HOME_ROUTES.tarotDaily,
    category: 'free-start',
    analyticsEvent: 'home_free_service_clicked',
  },
  {
    id: 'saju-reading',
    title: '내 사주풀이',
    description: '생년월일시로 내 사주의 기본 흐름을 봅니다.',
    priceLabel: HOME_PRICE_LABELS.paidFrom550,
    ctaLabel: '사주 시작',
    href: HOME_ROUTES.sajuNew,
    category: 'saju',
    analyticsEvent: 'home_theme_service_clicked',
  },
  {
    id: 'compatibility',
    title: '궁합',
    description: '두 사람의 관계 흐름과 맞물리는 지점을 확인합니다.',
    priceLabel: HOME_PRICE_LABELS.paid990,
    ctaLabel: '궁합 보기',
    href: HOME_ROUTES.compatibility,
    category: 'compatibility',
    analyticsEvent: 'home_theme_service_clicked',
  },
  {
    id: 'daewoon',
    title: '올해 흐름',
    description: '올해의 큰 흐름과 움직이기 좋은 때를 봅니다.',
    priceLabel: HOME_PRICE_LABELS.paid990,
    ctaLabel: '올해 흐름 보기',
    href: HOME_ROUTES.daewoon,
    category: 'saju',
    analyticsEvent: 'home_theme_service_clicked',
  },
  {
    id: 'taekil',
    title: '좋은 날',
    description: '중요한 선택과 약속에 맞는 날을 살펴봅니다.',
    priceLabel: HOME_PRICE_LABELS.inPreparation,
    ctaLabel: '좋은 날 보기',
    href: HOME_ROUTES.taekil,
    category: 'fortune',
    analyticsEvent: 'home_theme_service_clicked',
  },
  {
    id: 'zodiac',
    title: '띠운세',
    description: '내 띠 기준의 오늘 흐름을 가볍게 확인합니다.',
    priceLabel: HOME_PRICE_LABELS.free,
    ctaLabel: '띠운세 보기',
    href: HOME_ROUTES.zodiac,
    category: 'fortune',
    analyticsEvent: 'home_theme_service_clicked',
  },
  {
    id: 'star-sign',
    title: '별자리',
    description: '별자리별 오늘의 메시지를 확인합니다.',
    priceLabel: HOME_PRICE_LABELS.free,
    ctaLabel: '별자리 보기',
    href: HOME_ROUTES.starSign,
    category: 'fortune',
    analyticsEvent: 'home_theme_service_clicked',
  },
  {
    id: 'dialogue',
    title: '대화방',
    description: '혼자 정리하기 어려운 질문을 대화로 이어갑니다.',
    priceLabel: HOME_PRICE_LABELS.freeStart,
    ctaLabel: '대화방 열기',
    href: HOME_ROUTES.dialogue,
    category: 'consult',
    analyticsEvent: 'home_ai_dialogue_clicked',
  },
  {
    id: 'archive',
    title: '보관함',
    description: '이전에 본 풀이와 저장된 결과를 다시 확인합니다.',
    priceLabel: HOME_PRICE_LABELS.savedReports,
    ctaLabel: '보관함 보기',
    href: HOME_ROUTES.archive,
    category: 'archive',
    analyticsEvent: 'home_archive_clicked',
  },
  {
    id: 'pricing',
    title: '가격 안내',
    description: '필요한 풀이와 멤버십 옵션을 비교합니다.',
    priceLabel: HOME_PRICE_LABELS.pricingGuide,
    ctaLabel: '가격 보기',
    href: HOME_ROUTES.pricing,
    category: 'pricing',
    analyticsEvent: 'home_pricing_clicked',
  },
] as const satisfies readonly HomeServiceCard[];

export const HOME_FREE_START_CARD_IDS = ['today-fortune', 'tarot-daily'] as const;
