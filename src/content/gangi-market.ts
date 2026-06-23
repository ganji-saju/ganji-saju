import type { GangiZodiacKey } from '@/components/gangi/gangi-ui';
import type { StarSignKey } from '@/components/gangi/star-sign-chip';

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
  /**
   * 12간지 chip 키 (rat/ox/.../pig). chipKind 가 'zodiac' (또는 미지정) 일 때 렌더.
   * 카드 분류 자체는 zodiac 와 무관 — 단순 시각 cue.
   */
  zodiac: GangiZodiacKey;
  category: GangiServiceCategory;
  tag?: string;
  /**
   * 2026-05-20 — chip 렌더 모드.
   * 'zodiac' (default): ZodiacChip 으로 zodiac 키 사용.
   * 'star-sign': StarSignChip (12서양 별자리 전용). 특정 sign 은 starSign 으로,
   *   미지정이면 generic 밤하늘 통합 chip. zodiac 필드는 legacy fallback 으로 유지.
   */
  chipKind?: 'zodiac' | 'star-sign';
  /** chipKind === 'star-sign' 일 때 특정 별자리. 미지정 시 generic 12별자리 통합 chip. */
  starSign?: StarSignKey;
  /**
   * 2026-06-23 — 메인 캐릭터 카드 개편(slide3 시안). 캐릭터 일러스트 id.
   *   public/images/gangi/characters/{image}.{avif,webp,png}. 있으면 chip 대신 캐릭터 렌더.
   */
  image?: string;
  /** 후킹 카피(시안). 있으면 카드 본문에 desc 대신 headline 노출. */
  headline?: string;
  /**
   * 2026-06-23 — 메인 리디자인(간지사주 메인 리디자인.html). 카드 파스텔 틴트 배경.
   *   가로 레이아웃(원형 아바타 + 텍스트)에서 카드별 부드러운 배경색·가격색 결정.
   */
  tint?: 'pink' | 'plum' | 'sky' | 'coral' | 'indigo' | 'amber' | 'jade';
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

// 2026-06-23 — 메인 캐릭터 카드 개편(20260623 시안 slide3). 8카드 그리드:
//   상단 사주·대운·택일·궁합 / 하단 꿈해몽·대화상담·무료타로·무료운세.
//   각 카드 = 캐릭터 일러스트(image) + 메뉴명(title) + 후킹 카피(headline) + "바로 확인하기".
//   별자리(star-sign)·띠운세(zodiac)는 시안에서 빠짐 → 그리드 제외, 진입점은 상단 별자리 slot +
//   무료 허브(GANGI_FREE_HUB_ITEMS) 로 보존(라우트·SEO 유지, dead-anchor 회귀 방지).
//   price 라벨은 기존값 유지(페이월 정합 — 결제 오해 방지).
export const GANGI_HOME_CARDS: readonly GangiServiceCard[] = [
  {
    id: 'saju',
    title: '사주',
    desc: '내 사주 풀이',
    price: '9,900원',
    href: '/saju/new',
    zodiac: 'dragon',
    category: 'saju',
    image: 'saju',
    tint: 'pink',
  },
  {
    id: 'daewoon',
    title: '대운',
    desc: '10년 큰 흐름',
    // /daewoon 은 무료 예시 허브(실제 결과는 year-core 업셀). 가격 라벨 '무료' 유지(페이월 정합).
    price: '무료',
    href: '/daewoon',
    zodiac: 'tiger',
    category: 'saju',
    image: 'daewoon',
    tint: 'plum',
  },
  {
    id: 'taekil',
    title: '택일',
    desc: '좋은 날 찾기',
    // /taekil 은 무료 도구. 유료 '월간 좋은날 캘린더'는 결과 화면 업셀. 가격 라벨 '무료' 유지.
    price: '무료',
    href: '/taekil',
    zodiac: 'ox',
    category: 'fortune',
    image: 'taekil',
    tint: 'sky',
  },
  {
    id: 'gunghap',
    title: '궁합',
    desc: '두 사람의 흐름',
    price: '9,900원',
    href: '/compatibility/input',
    zodiac: 'sheep',
    category: 'saju',
    image: 'gunghap',
    tint: 'coral',
  },
  {
    id: 'dream',
    title: '꿈해몽',
    desc: '꿈 한 단어 풀이',
    price: '무료',
    href: '/dream',
    zodiac: 'dragon',
    category: 'fortune',
    image: 'dream',
    tint: 'indigo',
  },
  {
    id: 'consult',
    title: '대화상담',
    desc: '선생님께 묻기',
    price: '무료 시작',
    href: '/dialogue',
    zodiac: 'snake',
    category: 'consult',
    image: 'consult',
    tint: 'amber',
  },
  {
    id: 'tarot',
    title: '무료타로',
    desc: '한 장 뽑기',
    price: '무료',
    href: '/tarot/daily',
    zodiac: 'rabbit',
    category: 'fortune',
    tag: 'HOT',
    image: 'tarot',
    tint: 'jade',
  },
  {
    id: 'today',
    title: '무료운세',
    desc: '오늘 한 줄',
    price: '무료',
    href: '/today-fortune?concern=general',
    zodiac: 'rooster',
    category: 'fortune',
    tag: '추천',
    image: 'today',
    tint: 'pink',
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
    title: '타로 세 장',
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
    title: '타로 세 장',
    desc: '마음이 시키는 카드',
  },
  {
    href: '/zodiac',
    zodiac: 'horse',
    title: '띠운세',
    desc: '내 띠 오늘 흐름',
  },
  {
    // 2026-05-15 — 무료 hub 에서 검색 작동하는 /dream 으로.
    href: '/dream',
    zodiac: 'dragon',
    title: '꿈해몽',
    desc: '꿈으로 보는 길흉',
  },
] as const;
