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
    title: '오늘운세 · 오늘소선생',
    desc: '지금 핵심 한 줄',
    price: '무료',
    href: '/today-fortune?concern=general',
    zodiac: 'rooster',
    category: 'fortune',
    tag: '추천',
  },
  {
    id: 'tarot',
    title: '타로 한 장 · 타로토선생',
    desc: '마음이 시키는 카드',
    price: '무료',
    href: '/tarot/daily',
    zodiac: 'rabbit',
    category: 'fortune',
    tag: 'HOT',
  },
  {
    id: 'saju',
    title: '사주 · 사주용선생',
    desc: '내 사주 풀이',
    price: '550원~',
    href: '/saju/new',
    zodiac: 'dragon',
    category: 'saju',
  },
  {
    id: 'gunghap',
    title: '궁합 · 궁합양선생',
    desc: '둘 사이의 흐름',
    price: '990원',
    href: '/compatibility/input',
    zodiac: 'sheep',
    category: 'saju',
  },
  {
    id: 'daewoon',
    title: '올해 흐름 · 명리호선생',
    desc: '진행하기 좋은 달',
    // 2026-06-07 — /daewoon 은 무료 예시 허브(실제 결과는 year-core 3,900원 업셀).
    //   990원 가격 라벨이 무료 허브 입구에 잘못 붙어 결제 오해 유발하던 것 정정.
    price: '무료',
    href: '/daewoon',
    zodiac: 'tiger',
    category: 'saju',
  },
  {
    id: 'taekil',
    title: '좋은 날 · 길일말선생',
    desc: '중요한 날 확인',
    // 2026-06-07 — /taekil(좋은 날 찾기)은 무료 도구. 유료 1,900원 상품은 별개인
    //   '월간 좋은날 캘린더'(monthly-calendar)이며 결과 화면에서 업셀로 안내.
    //   가격 라벨이 무료 도구 입구에 1,900원으로 잘못 붙어 결제 오해를 유발하던 것 정정.
    price: '무료',
    href: '/taekil',
    zodiac: 'ox',
    category: 'fortune',
  },
  {
    // 2026-05-20 — 사용자 보고: 메인 카드 그리드에 별자리 진입점 누락.
    //   꿈해몽 자리 (이전 7번) 에 별자리 배치, 꿈해몽은 마지막으로 이동.
    // 2026-05-20 (PR γ) — 12간지 'pig' chip 차용 → 12서양 별자리 전용 chip
    //   (StarSignChip generic — 밤하늘 + ✦) 으로 교체. 시각적 일관성 보강.
    //   zodiac: 'pig' 는 chipKind 미지원 환경 fallback 으로 그대로 둠.
    id: 'star-sign',
    title: '별자리 · 별닭선생',
    desc: '12자리 오늘 메시지',
    price: '무료',
    href: '/star-sign',
    zodiac: 'pig',
    chipKind: 'star-sign',
    category: 'fortune',
  },
  {
    id: 'zodiac',
    title: '띠운세 · 엠지쥐선생',
    desc: '내 띠의 오늘 흐름',
    price: '무료',
    href: '/zodiac',
    zodiac: 'horse',
    category: 'fortune',
  },
  {
    id: 'consult',
    title: '대화 상담 · 상담멍선생',
    desc: '선생님께 묻기',
    price: '무료 시작',
    href: '/dialogue',
    zodiac: 'snake',
    category: 'consult',
  },
  {
    // 2026-05-15 — 꿈해몽 메뉴. 2026-05-15(2) — /dream-interpretation 은 옛 디자인 +
    // 검색 미작동이라 사용자가 "검색이 안 된다" 고 느낌. 검색 작동 페이지 /dream 으로 변경.
    // 2026-05-20 — 별자리 카드 추가하면서 마지막 위치로 이동 (꿈해몽 ↔ 별자리 위치 교체).
    id: 'dream',
    title: '꿈해몽 · 꿈뱀선생',
    desc: '꿈으로 보는 길흉',
    price: '무료',
    href: '/dream',
    zodiac: 'dragon',
    category: 'fortune',
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
