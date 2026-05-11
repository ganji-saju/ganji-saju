import type { MoonlightAnalyticsEvent } from '@/lib/analytics-events';
import { HOME_PRODUCT_COPY } from './homeCopy';
import { HOME_ROUTES } from './homeNavigation';

export type HomeFeatureCardBadge = 'NEW' | 'HOT';

export type HomeFeatureCard = {
  id: 'saju-personality' | 'personality-compatibility';
  badge: HomeFeatureCardBadge;
  title: string;
  description: string;
  priceLabel: string;
  ctaLabel: string;
  href: string;
  analyticsEvent: MoonlightAnalyticsEvent;
  productCode: string;
  productName: string;
};

export const HOME_FEATURE_CARDS = [
  {
    id: 'saju-personality',
    badge: 'NEW',
    title: '달빛 성향사주',
    description: '사주로 보는 타고난 결, 성향으로 보는 나의 선택 습관.',
    priceLabel: HOME_PRODUCT_COPY.sajuPersonalityMini.priceLabel,
    ctaLabel: '내 성향사주 보기',
    href: HOME_ROUTES.sajuPersonality,
    analyticsEvent: 'home_primary_feature_clicked',
    productCode: HOME_PRODUCT_COPY.sajuPersonalityMini.productCode,
    productName: HOME_PRODUCT_COPY.sajuPersonalityMini.name,
  },
  {
    id: 'personality-compatibility',
    badge: 'HOT',
    title: '달빛 성향궁합',
    description: '두 사람의 사주와 성향을 함께 보고 관계의 흐름을 정리합니다.',
    priceLabel: HOME_PRODUCT_COPY.personalityCompatibilityMini.priceLabel,
    ctaLabel: '우리 성향궁합 보기',
    href: HOME_ROUTES.personalityCompatibility,
    analyticsEvent: 'home_primary_feature_clicked',
    productCode: HOME_PRODUCT_COPY.personalityCompatibilityMini.productCode,
    productName: HOME_PRODUCT_COPY.personalityCompatibilityMini.name,
  },
] as const satisfies readonly HomeFeatureCard[];
