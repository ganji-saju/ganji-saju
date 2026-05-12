import type { GangiZodiacKey } from '@/components/gangi/gangi-ui';

export const GANGI_HOME_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'saju', label: '사주·명리' },
  { key: 'fortune', label: '운세·택일' },
  { key: 'consult', label: '상담' },
] as const;

export type GangiHomeCategoryKey = (typeof GANGI_HOME_CATEGORIES)[number]['key'];

export type GangiServiceCategory = Exclude<GangiHomeCategoryKey, 'all'>;

export type GangiServiceCard = {
  id: string;
  title: string;
  desc: string;
  price: string;
  href: string;
  zodiac: GangiZodiacKey;
  category: GangiServiceCategory;
  tag?: string;
};

export type GangiHomeBanner = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  zodiac?: GangiZodiacKey;
  tone: 'pink' | 'soft' | 'night';
};

export const GANGI_HOME_BANNERS: readonly GangiHomeBanner[] = [
  {
    id: 'today-flow',
    kicker: '오늘의 한 줄',
    title: '오늘, 작은 결정이 큰 흐름을 바꾸는 날',
    description: '크게 벌리기보다 지금 필요한 한 가지를 먼저 골라보세요.',
    cta: '오늘운세 보러가기',
    href: '/today-fortune?concern=general',
    tone: 'pink',
  },
  {
    id: 'zodiac-week',
    kicker: '오늘의 띠',
    title: '오늘의 띠운세를 확인해 보세요',
    description: '12간지 중 오늘의 흐름이 매일 새롭게 열립니다.',
    cta: '12띠 운세 모두 보기',
    href: '/zodiac',
    zodiac: 'rooster',
    tone: 'soft',
  },
  {
    id: 'star-week',
    kicker: '오늘의 별자리',
    title: '오늘의 별자리 흐름을 확인해 보세요',
    description: '열두 별자리 중 오늘의 메시지를 가볍게 보여드려요.',
    cta: '자세히 보기',
    href: '/star-sign',
    tone: 'night',
  },
] as const;

export const GANGI_HOME_CARDS: readonly GangiServiceCard[] = [
  {
    id: 'today',
    title: '오늘운세',
    desc: '지금 핵심 한 줄',
    price: '무료',
    href: '/today-fortune?concern=general',
    zodiac: 'rooster',
    category: 'fortune',
    tag: '추천',
  },
  {
    id: 'tarot',
    title: '타로 한 장',
    desc: '마음이 시키는 카드',
    price: '무료',
    href: '/tarot/daily',
    zodiac: 'rabbit',
    category: 'fortune',
    tag: 'HOT',
  },
  {
    id: 'saju',
    title: '사주',
    desc: '내 사주 풀이',
    price: '550원~',
    href: '/saju/new',
    zodiac: 'dragon',
    category: 'saju',
  },
  {
    id: 'gunghap',
    title: '궁합',
    desc: '둘 사이의 흐름',
    price: '990원',
    href: '/compatibility/input',
    zodiac: 'sheep',
    category: 'saju',
  },
  {
    id: 'daewoon',
    title: '올해 흐름',
    desc: '진행하기 좋은 달',
    price: '990원',
    href: '/daewoon',
    zodiac: 'tiger',
    category: 'saju',
  },
  {
    id: 'taekil',
    title: '좋은 날',
    desc: '중요한 날 확인',
    price: '준비 중',
    href: '/taekil',
    zodiac: 'ox',
    category: 'fortune',
  },
  {
    id: 'zodiac',
    title: '띠운세',
    desc: '내 띠의 오늘 기준',
    price: '무료',
    href: '/zodiac',
    zodiac: 'horse',
    category: 'fortune',
  },
  {
    id: 'consult',
    title: '대화 상담',
    desc: '12간지에게 묻기',
    price: '무료 시작',
    href: '/dialogue',
    zodiac: 'snake',
    category: 'consult',
  },
] as const;

export const GANGI_FREE_ACTIONS = [
  {
    id: 'today',
    href: '/today-fortune?concern=general',
    label: 'FREE',
    title: '오늘운세',
    desc: '지금 바로 한 줄',
    mark: 'sun',
    zodiac: 'rooster',
  },
  {
    id: 'tarot',
    href: '/tarot/daily',
    label: 'FREE',
    title: '타로 한 장',
    desc: '마음이 시키는 카드',
    mark: 'card',
    zodiac: 'rabbit',
  },
] as const;

export const GANGI_FREE_HUB_ITEMS = [
  {
    href: '/today-fortune?concern=general',
    zodiac: 'rooster',
    title: '오늘운세',
    desc: '지금 한 줄로 보는 흐름',
  },
  {
    href: '/tarot/daily',
    zodiac: 'rabbit',
    title: '타로 한 장',
    desc: '마음이 시키는 카드',
  },
  {
    href: '/zodiac',
    zodiac: 'horse',
    title: '띠운세',
    desc: '내 띠 기준 오늘 흐름',
  },
  {
    href: '/star-sign',
    zodiac: 'rabbit',
    title: '별자리',
    desc: '열두 별자리 오늘 흐름',
  },
] as const;
