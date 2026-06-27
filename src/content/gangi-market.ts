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
  /**
   * 2026-06-26 — 완성형 이미지 배너(3:1). 지정 시 캐러셀이 picture(avif/webp/png)로 렌더하고
   * 텍스트 배너 레이어를 대체한다. public/images/gangi/banners/{image}.{avif,webp,png}.
   */
  image?: string;
  /** 이미지 배너 접근성 대체텍스트. */
  alt?: string;
};

// 2026-06-26 — 완성형 이미지 배너로 교체(사용자 제작 배너1·3·도사·2). 3:1 이미지가 문구를
//   포함하므로 캐러셀은 이미지만 풀블리드 렌더. kicker/title/cta 는 추적·폴백용으로 유지.
export const GANGI_HOME_BANNERS: readonly GangiHomeBanner[] = [
  {
    id: 'consult-pro',
    image: 'consult-pro',
    alt: '사주·명리·타로 전문 상담사 — 경험과 해석력을 갖춘 상담사와 상담하세요',
    kicker: '전문 상담',
    title: '사주·명리·타로 전문 상담사',
    description: '경험과 해석력을 갖춘 상담사와 믿고 상담하세요.',
    cta: '전문 상담 보기',
    href: '/dialogue',
    tone: 'soft',
  },
  {
    id: 'tarot-free',
    image: 'tarot-free',
    alt: '공짜로 보는 운세·타로 — 오늘의 운세와 타로를 무료로 시작',
    kicker: '무료',
    title: '공짜로 보는 운세·타로',
    description: '오늘의 운세와 타로를 무료로 가볍게 시작해보세요.',
    cta: '무료로 보기',
    href: '/tarot/daily',
    tone: 'soft',
  },
  {
    id: 'saju-9900',
    image: 'saju-9900',
    alt: '9,900원 내 사주 풀이 — 사주·명리 상담',
    kicker: '사주·명리',
    title: '9,900원 내 사주 풀이',
    description: '복잡한 고민, 방향이 필요할 때 부담 없이 시작하세요.',
    cta: '지금 확인하기',
    href: '/saju/new',
    tone: 'pink',
  },
  {
    id: 'talk',
    image: 'talk',
    alt: '말 못 할 고민 바로 상담 — 연애·진로·인간관계',
    kicker: '대화상담',
    title: '말 못 할 고민, 바로 상담',
    description: '연애·진로·인간관계·마음고민, 혼자 끌어안지 말고 편하게 이야기해요.',
    cta: '바로 상담하기',
    href: '/dialogue',
    tone: 'soft',
  },
  {
    id: 'dream',
    image: 'dream',
    alt: '꿈해몽 — 당신의 꿈, 어떤 메시지를 담고 있을까요? 꿈 한 단어 풀이',
    kicker: '꿈해몽',
    title: '꿈자리가 도대체 왜 이래',
    description: '당신의 꿈, 어떤 메시지를 담고 있을까요?',
    cta: '꿈 풀이 보기',
    href: '/dream',
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
    tag: 'HOT',
    image: 'saju',
    tint: 'pink',
  },
  {
    id: 'daewoon',
    title: '대운',
    desc: '10년 큰 흐름',
    // 2026-06-24 — 대운 풀이(올해 핵심, year-core)는 9,900원. /daewoon 은 무료 예시 허브 +
    //   year-core 9,900원 결제 CTA(daewoon/page.tsx). catalog year-core=9,900 과 표시 일치.
    price: '9,900원',
    href: '/daewoon',
    zodiac: 'tiger',
    category: 'saju',
    tag: '추천',
    image: 'daewoon',
    tint: 'plum',
  },
  {
    id: 'taekil',
    title: '택일',
    desc: '좋은 날 찾기',
    // 2026-06-24 — 택일(월간 좋은날 캘린더, monthly-calendar)은 9,900원. /taekil 은 무료 도구 +
    //   monthly-calendar 9,900원 결제 CTA(taekil-client.tsx). catalog monthly-calendar=9,900 과 일치.
    price: '9,900원',
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
