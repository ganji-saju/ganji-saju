import type { GangiZodiacKey } from '@/components/gangi/gangi-ui';
import type { StarSignKey } from '@/components/gangi/star-sign-chip';
import { isPaywallLockdown, keepVisible } from '@/lib/paywall-lockdown';
import type { PriceKey } from '@/lib/payments/price-display-shared';

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
  /**
   * 2026-07-07 Phase 2 — 가격 표시 단일화. 지정 시 소비처가 리졸버(admin product_prices)
   *   값으로 렌더하고 price 문자열은 fallback. 무료 카드는 미지정(price='무료' 유지).
   */
  priceKey?: PriceKey;
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
   * 2026-07-19 — 카드별 제목 글자색(사용자 요청: "카드마다 다양하게 눈에 띄게").
   *
   * ⚠️ 대비는 **원본 사진이 아니라 비네팅(scrim) 합성 후 배경**에 대고 계산할 것.
   *   처음엔 원본 사진 밴드 평균색에 대고 최적화했는데, 사진 위에는 이미
   *   `to top, rgba(12,7,14,.86) → transparent 62%` 스크림이 깔려 있다.
   *   그래서 배경이 밝은 사진(꿈해몽·간단운세·사주)에는 "어두운 글씨"가 최적이라고
   *   나왔고, 실제 렌더에서는 **어두운 스크림 위 어두운 글씨** = 안 보였다.
   *   사용자가 지목한 3개가 정확히 대비 최하위 3개(2.23·2.32·2.65)였다.
   *
   * 현재 값: 스크림 합성 후 배경(글자가 놓이는 하단 6~28% 띠의 밝은쪽 85퍼센타일)에
   *   대해 대비를 계산하고, **8색 전부 밝은색 + 서로 다른 색상 계열**(흰/노랑/주황/분홍/
   *   보라/하늘/민트/라임) 제약 아래 최저 대비가 최대가 되는 배정을 골랐다.
   *   최저 4.27:1 (큰 글씨 기준 3:1 충족).
   *   사진·제목 위치·스크림 중 하나라도 바꾸면 대비를 다시 계산할 것.
   */
  titleColor?: string;
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
  /** 2026-08-25 — 수호신 캐릭터 id(guardians/{id}.jpg). 텍스트 배너 우측 초상. */
  character?: string;
};

// 2026-08-24 전면 개편 Phase 0 — 이미지 배너 폐지, 텍스트 배너 복귀(수정요청 PPT 1차).
//   이유: ① 가격·문구가 이미지에 그려져 있어 가격 이벤트마다 이미지 재작업 ② 정체성 없는
//   실사 스톡톤(사용자 지시: 전량 삭제). 카피는 PPT 5·6안 — 히어로(가치 제안)와
//   신뢰(자격 5종·17항목)가 캐러셀 1·2번을 차지한다.
const ALL_GANGI_HOME_BANNERS: readonly GangiHomeBanner[] = [
  {
    // PPT 5안 히어로 카피. id 'saju-9900' 은 추적 연속성 때문에 유지(가격 아님, 배너 식별자).
    id: 'saju-9900',
    kicker: '사주·명리',
    title: '내 앞날을 조금이라도 알 수 있다면',
    description: '다가올 기회는 놓치지 않고, 조심해야 할 순간은 미리 준비하세요.',
    cta: '무료로 내 사주 확인하기',
    character: 't7', // 손 내미는 환영 포즈 — 히어로
    // 2026-08-24 Phase 1 — 결제 직행(?product=today-detail) → 무료 맛보기 경유로 전환.
    //   무료 결과(/saju/[slug])의 17항목 목차(ComprehensiveToc)가 종합 리포트 업셀을 담당한다.
    href: '/saju/new',
    tone: 'pink',
  },
  {
    // PPT 6안 신뢰 카피 — "왜 여기서 봐야 하나"에 첫 화면에서 답한다.
    id: 'trust-creds',
    kicker: '왜 간지사주인가',
    title: '자격을 갖춘 17가지 항목 분석',
    description:
      '명리심리상담사 1급 등 전문 자격 5종 보유. 용어 나열이 아니라 "앞으로 어떻게"를 알려드립니다.',
    cta: '풀이 방식 보기',
    href: '/verification',
    tone: 'soft',
  },
  {
    id: 'consult-pro',
    kicker: '전문 상담',
    title: '사주·명리·타로 전문 상담사',
    description: '경험과 해석력을 갖춘 상담사와 믿고 상담하세요.',
    cta: '전문 상담 보기',
    href: '/dialogue',
    tone: 'soft',
  },
  {
    id: 'talk',
    kicker: '대화상담',
    title: '말 못 할 고민, 바로 상담',
    description: '연애·진로·인간관계·마음고민, 혼자 끌어안지 말고 편하게 이야기해요.',
    cta: '바로 상담하기',
    href: '/dialogue',
    tone: 'soft',
  },
  {
    id: 'tarot-free',
    kicker: '무료',
    title: '공짜로 보는 운세·타로',
    description: '오늘의 운세와 타로를 무료로 가볍게 시작해보세요.',
    cta: '무료로 보기',
    href: '/tarot/daily',
    tone: 'soft',
  },
  {
    id: 'dream',
    kicker: '꿈해몽',
    title: '꿈자리가 도대체 왜 이래',
    description: '당신의 꿈, 어떤 메시지를 담고 있을까요?',
    cta: '꿈 풀이 보기',
    href: '/dream',
    tone: 'night',
  },
] as const;

// 2026-08-11 전면 유료화 잠금 — 무료 콘텐츠로 보내는 배너 제거(tarot-free·dream).
//   잠금 중 무료 배너가 남으면 클릭 → /pricing 으로 튕겨 낚시가 된다. 링크 기준으로 건다.
export const GANGI_HOME_BANNERS: readonly GangiHomeBanner[] = keepVisible(
  ALL_GANGI_HOME_BANNERS,
  (banner) => banner.href
);

// 2026-06-23 — 메인 캐릭터 카드 개편(20260623 시안 slide3). 8카드 그리드.
//   각 카드 = 캐릭터 일러스트(image) + 메뉴명(title) + 후킹 카피(headline) + "바로 확인하기".
//   별자리(star-sign)·띠운세(zodiac)는 시안에서 빠짐 → 그리드 제외, 진입점은 상단 별자리 slot +
//   무료 허브(GANGI_FREE_HUB_ITEMS) 로 보존(라우트·SEO 유지, dead-anchor 회귀 방지).
//   price 라벨은 기존값 유지(페이월 정합 — 결제 오해 방지).
// 2026-07-04 — 무료 진입점 우선 배치(사용자 지시): 상단 무료운세·무료타로(HOT) /
//   사주·대운(추천)은 한 줄 아래로 / 이후 택일·궁합·꿈해몽·대화상담.
// 2026-07-18 — 위 배치를 되돌림(20260718 PPTX slide2·3, 사주아이 벤치마크). 무료를 먼저 보면
//   결제 욕구가 떨어진다는 진단 → **유료(사주·대운·택일·궁합) 상단 / 무료 4종 하단**.
//   HOT 배지도 무료 → 유료로 이동해 시선 우선순위 1번을 유료에 둔다.
//   무료 카드 문구는 "제한적·간단함"을 제목에서 드러내고(간단운세 / 딱 3장 타로 /
//   한 단어 꿈해몽 / 질문 하나 대화상담) 부제는 "언제 쓰는가"로 통일.
//   유료 카드 부제는 "이걸 통해 뭘 얻는가"로 통일(slide4).
// 2026-07-19 — 제목을 카드 **상단 밴드**로 올리고 크게 키우면서(사용자 요청) 제목을 짧게 정리.
//   '한 단어 꿈해몽'→'꿈해몽', '질문 하나 대화상담'→'대화상담', '딱 3장 타로'→'타로'.
//   제목 크기를 전 카드 통일했기 때문에 **가장 긴 제목이 전체 크기의 상한**이 된다 —
//   긴 제목 하나가 나머지 7개를 함께 작게 만든다. 그래서 짧게
//   오히려 짧은 제목보다 작아져 "크게"의 취지가 깨진다. 제한 뉘앙스(한 단어/질문 하나)는
//   제목에서 빠졌으니 되살리려면 desc 로 옮길 것.
// 2026-08-24 전면 개편 Phase 0 — 실사 인물 사진(image)·사진용 titleColor 전량 제거(사용자 지시).
//   카드가 chip 폴백(띠 문양)으로 렌더된다. Phase 2 에서 12지신 수호신 캐릭터가 image 로 복귀 예정.
// 2026-08-24 Phase 1 — 단품 강등(사용자 결정): 대운·택일 카드를 홈에서 내린다. 두 상품은
//   결과·구매 후 화면의 교차추천(paid-funnel-grid)과 /daewoon·/taekil 랜딩으로 계속 판다.
//   홈 간판은 종합 리포트(사주 카드) 하나 + 대상이 다른 궁합만 남긴다.
const ALL_GANGI_HOME_CARDS: readonly GangiServiceCard[] = [
  {
    id: 'saju',
    title: '사주',
    // 2026-08-24 Phase 1 — 간판 상품 전환: 오늘상세(3,300) 직행 → 무료 맛보기 → 종합 리포트
    //   (bundle_comprehensive, 출시 기념가 9,900·compareAt 33,000). 2026-07-18 "중간맛보기
    //   필요없음" 지시는 이번 개편 결정(무료 맛보기 재개방, 수정요청 PPT 1차)으로 뒤집혔다.
    desc: '17항목 종합 리포트',
    price: '9,900원',
    priceKey: 'bundle_comprehensive',
    href: '/saju/new',
    zodiac: 'dragon',
    category: 'saju',
    tag: 'HOT',
    // 2026-08-25 Phase 2 — 12지신 수호신 2차분 적용: 카드마다 자기 zodiac 키의 수호신.
    //   임시로 쓰던 호랑이(t6)를 내리고 카드 chip 과 같은 용(辰)으로 정렬.
    image: 'dragon',
    tint: 'pink',
  },
  {
    id: 'gunghap',
    title: '궁합',
    desc: '나와 맞는 사람은?',
    // 2026-07-07 Phase 2 — 궁합 과금 경로 = love-question(taste_love_question).
    //   2026-07-18 실측: product_prices 는 0행(오버라이드 없음) → catalog 값이 곧 라이브 청구가.
    //   구 주석의 "프로덕션 990 오버라이드"는 stale 이라 정정.
    price: '3,300원',
    priceKey: 'taste_compat_reading',
    href: '/compatibility/input',
    zodiac: 'sheep',
    category: 'saju',
    tag: '추천',
    image: 'sheep',
    tint: 'coral',
  },
  // ── 990원 유료 2종 — 타로·대화상담을 한 줄로(2026-08-25 사용자 지시). ──
  {
    id: 'tarot',
    title: '타로',
    desc: '지금 급할 때',
    price: '990원',
    priceKey: 'taste_tarot_daily',
    href: '/tarot/daily',
    zodiac: 'rabbit',
    category: 'fortune',
    image: 'rabbit',
    tint: 'jade',
  },
  {
    id: 'consult',
    title: '대화상담',
    // 2026-08-25 — 당일권 → **질문 3회**(사용자 확정). 전달물=전 3개(ai_chat 3턴 묶음).
    desc: '선생님께 질문 3회',
    price: '990원',
    priceKey: 'taste_dialogue_entry',
    href: '/dialogue',
    zodiac: 'snake',
    category: 'consult',
    image: 'snake',
    tint: 'amber',
  },
  // ── 무료 4종 (2026-08-25 사용자 확정: 간단운세·꿈해몽 무료 복귀 / 다음 줄 띠·별자리) ──
  //   잠금(lockdown) 중엔 price '무료' 필터가 이 넷을 감춘다.
  {
    id: 'today',
    title: '간단운세',
    desc: '짧은 운세풀이',
    price: '무료',
    href: '/today-fortune?concern=general',
    zodiac: 'rooster',
    category: 'fortune',
    image: 'rooster',
    tint: 'pink',
  },
  {
    id: 'dream',
    title: '꿈해몽',
    desc: '마음이 찜찜할 때',
    price: '무료',
    href: '/dream',
    zodiac: 'pig',
    category: 'fortune',
    image: 'pig',
    tint: 'indigo',
  },
  {
    id: 'zodiac',
    title: '띠운세',
    desc: '내 띠 오늘 흐름',
    price: '무료',
    href: '/zodiac',
    zodiac: 'horse',
    category: 'fortune',
    image: 'horse',
    tint: 'amber',
  },
  {
    id: 'star-sign',
    title: '별자리',
    desc: '12자리 오늘 메시지',
    price: '무료',
    href: '/star-sign',
    // 2026-08-25 — 미사용 수호신 중 원숭이(申): 윤도(천문 방위 나침반) 소지가
    //   별자리(하늘 관측)와 가장 맞다(사용자 지시: 중복 없는 것 중 어울리는 이미지).
    zodiac: 'monkey',
    category: 'fortune',
    image: 'monkey',
    tint: 'sky',
  },
] as const;

// 2026-08-11 전면 유료화 잠금 — 홈 그리드에서 무료 카드를 뺀다.
//   두 조건 모두 제거 대상이다:
//     · price === '무료'  → 값 자체가 무료라고 광고하는 카드(간단운세·타로·꿈해몽·대화상담)
//     · 링크가 잠긴 경로  → 눌러도 /pricing 으로 튕기는 카드
//   '대화상담'은 라우트(/dialogue)가 살아 있어 메가 메뉴 '대화' 그룹과 푸터로는 계속 닿는다.
export const GANGI_HOME_CARDS: readonly GangiServiceCard[] = keepVisible(
  isPaywallLockdown()
    ? ALL_GANGI_HOME_CARDS.filter((card) => card.price !== '무료')
    : ALL_GANGI_HOME_CARDS,
  (card) => card.href
);

// 2026-08-25 전면 개편 — 오늘운세·타로가 990원 유료로 전환되며 FREE 스트립은
//   진짜 무료로 남는 둘(띠운세·별자리)만 노출한다(사용자 확정).
const ALL_GANGI_FREE_ACTIONS = [
  {
    id: 'zodiac',
    href: '/zodiac',
    label: 'FREE',
    title: '띠운세',
    desc: '내 띠 오늘 흐름',
    mark: 'sun',
    zodiac: 'horse',
  },
  {
    id: 'star-sign',
    href: '/star-sign',
    label: 'FREE',
    title: '별자리 운세',
    desc: '12자리 오늘 메시지',
    mark: 'card',
    zodiac: 'pig',
  },
] as const;

/**
 * 무료 액션 스트립('FREE' 배지 고정). 잠금 시 통째로 비운다 —
 * 링크 필터만 걸면 오늘운세가 살아남아 유료 메뉴에 'FREE' 배지가 붙는다.
 */
export const GANGI_FREE_ACTIONS = isPaywallLockdown()
  ? ([] as typeof ALL_GANGI_FREE_ACTIONS[number][])
  : [...ALL_GANGI_FREE_ACTIONS];

// 2026-08-25 — 무료 4종(간단운세·꿈해몽·띠운세·별자리). 타로·대화상담만 990원 유료.
const ALL_GANGI_FREE_HUB_ITEMS = [
  {
    href: '/today-fortune?concern=general',
    zodiac: 'rooster',
    title: '간단운세',
    desc: '지금 한 줄로 보는 흐름',
  },
  {
    href: '/dream',
    zodiac: 'pig',
    title: '꿈해몽',
    desc: '꿈으로 보는 길흉',
  },
  {
    href: '/zodiac',
    zodiac: 'horse',
    title: '띠운세',
    desc: '내 띠 오늘 흐름',
  },
  {
    href: '/star-sign',
    zodiac: 'monkey',
    title: '별자리 운세',
    desc: '12자리 오늘 메시지',
  },
] as const;

/**
 * /free 허브 목록('FREE' 가격표 고정). 잠금 시 /free 라우트 자체가 막히지만
 * 데이터도 통째로 비운다(오늘운세가 남아 'FREE'로 표시되는 것 방지).
 */
export const GANGI_FREE_HUB_ITEMS = isPaywallLockdown()
  ? ([] as typeof ALL_GANGI_FREE_HUB_ITEMS[number][])
  : [...ALL_GANGI_FREE_HUB_ITEMS];
