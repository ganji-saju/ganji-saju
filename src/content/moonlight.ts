export type MoonlightTone = 'gold' | 'goldSoft' | 'jade' | 'plum' | 'sky' | 'coral';
export type MoonlightNavTone = 'service' | 'acquisition';
export type PlanSlug = 'basic' | 'premium' | 'lifetime';
export type CompatibilityRelationshipSlug = 'lover' | 'family' | 'friend' | 'partner';
export type DalbitTeacherSlug =
  | 'mg-ji'
  | 'today-so'
  | 'myeongri-ho'
  | 'tarot-to'
  | 'saju-yong'
  | 'dream-baem'
  | 'move-mal'
  | 'compat-yang'
  | 'face-won'
  | 'wealth-dak'
  | 'palm-meong'
  | 'luck-dwaeji';
export type DalbitTeacherStatus = 'active' | 'coming-soon';

export interface MoonlightNavItem {
  label: string;
  href: string;
  matchPrefixes?: readonly string[];
  tone?: MoonlightNavTone;
}

export interface MoonlightWisdomCard {
  slug: string;
  hanja: string;
  title: string;
  hook: string;
  description: string;
  href: string;
  tone: MoonlightTone;
}

export interface CompatibilityRelationship {
  slug: CompatibilityRelationshipSlug;
  icon: string;
  title: string;
  hook: string;
}

export interface MoonlightTarotQuestionOption {
  emoji: string;
  label: string;
  intent: string;
  description: string;
  when: string;
}

export interface MoonlightTenGodCard {
  name: string;
  hanja: string;
  meaning: string;
  seniorCopy: string;
}

export interface MoonlightDialoguePreset {
  category: string;
  question: string;
  previewAnswer: string;
  followUp: string;
}

export interface MoonlightToneOption {
  value: 'friendly' | 'polite' | 'standard';
  label: string;
  description: string;
}

export type NotificationSlotKey =
  | 'today-fortune'
  | 'today-tarot'
  | 'today-zodiac'
  | 'today-star-sign'
  | 'subscription-expiring'
  | 'comeback-reminder';

export interface MoonlightNotificationSlot {
  key: NotificationSlotKey;
  title: string;
  body: string;
  timeLabel: string;
  cadence: string;
  tone: MoonlightTone;
}

export interface MoonlightWidgetBlueprint {
  size: 'small' | 'medium' | 'large';
  title: string;
  summary: string;
  details: readonly string[];
}

export interface MoonlightRetentionScenario {
  trigger: string;
  action: string;
  purpose: string;
}

export interface MoonlightQuestionEntryPoint {
  slug: 'love' | 'money' | 'career' | 'family' | 'year' | 'today';
  label: string;
  question: string;
  productName: string;
  reportAnswer: string;
  href: string;
}

export interface MoonlightTasteProduct {
  slug: string;
  title: string;
  price: string;
  question: string;
  result: string;
  href: string;
  status: string;
  teacherSlug: DalbitTeacherSlug;
  // 2026-05-19 — true 면 사주 컨텍스트(/saju/[slug]/premium · /sample-report) 의 cross-sell
  //   에서 제외. 사용자가 사주를 보다가 두 사람 입력 화면으로 튕기는 것 방지.
  //   love-question 처럼 궁합 흐름 전용 상품에 사용.
  compatibilityOnly?: boolean;
}

export interface DalbitTeacherCard {
  slug: DalbitTeacherSlug;
  teacherName: string;
  animal: string;
  zodiac: string;
  zodiacOrder: number;
  serviceTitle: string;
  shortLabel: string;
  role: string;
  question: string;
  href: string;
  productPosition: string;
  status: DalbitTeacherStatus;
}

export const PRIMARY_TABS: readonly MoonlightNavItem[] = [
  { label: '홈', href: '/' },
  {
    label: '사주추가',
    href: '/saju/new',
    matchPrefixes: ['/saju'],
  },
  {
    label: '무료운세',
    href: '/free',
    matchPrefixes: [
      '/free',
      '/today-fortune',
      '/tarot',
      '/zodiac',
      '/star-sign',
      '/interpretation',
    ],
  },
  { label: '대화방', href: '/dialogue', matchPrefixes: ['/dialogue', '/compatibility'] },
  { label: '보관함', href: '/my/results', matchPrefixes: ['/my', '/membership', '/credits'] },
] as const;

export const HEADER_SHORTCUTS: readonly MoonlightNavItem[] = [
  { label: '오늘운', href: '/today-fortune', matchPrefixes: ['/today-fortune'], tone: 'acquisition' },
  { label: '타로', href: '/tarot/daily', matchPrefixes: ['/tarot'], tone: 'acquisition' },
  { label: '사주', href: '/saju/new', matchPrefixes: ['/saju'], tone: 'service' },
  { label: '궁합', href: '/compatibility', matchPrefixes: ['/compatibility'], tone: 'service' },
  { label: '띠운세', href: '/zodiac', matchPrefixes: ['/zodiac'], tone: 'service' },
  { label: '별자리', href: '/star-sign', matchPrefixes: ['/star-sign'], tone: 'service' },
] as const;

export const HOME_DAILY_LINES = [
  {
    title: '오늘은 서두르기보다 마음을 고르게 하시면 길이 열립니다',
    subtitle: '가까운 분과 나누는 짧은 안부 한마디가 하루의 기운을 부드럽게 바꿉니다',
  },
  {
    title: '마음을 낮추실수록 반가운 소식이 먼저 닿는 날입니다',
    subtitle: '오후 무렵 닿는 연락 하나가 생각보다 오래 따뜻하게 남을 수 있습니다',
  },
  {
    title: '오래 미루신 일을 조용히 매듭지으시면 다음 흐름이 열립니다',
    subtitle: '큰 결심보다 작은 정리가 한 달의 리듬을 바로잡아 드립니다',
  },
] as const;

export const HOME_HERO_TOKENS = [
  { label: '행운 방향', value: '서북' },
  { label: '길한 시간', value: '오후 2시' },
  { label: '마음가짐', value: '차분함' },
] as const;

export const REPORT_SAMPLE_HREF = '/sample-report';

export const QUESTION_ENTRY_POINTS: readonly MoonlightQuestionEntryPoint[] = [
  {
    slug: 'love',
    label: '연애',
    question: '연애가 자꾸 꼬이는 이유',
    productName: '관계 패턴 풀이',
    reportAnswer: '반복되는 서운함, 연락 속도, 다시 이어질 가능성을 사주와 관계 흐름으로 나눠 봅니다.',
    href: '/saju/new?focus=love',
  },
  {
    slug: 'money',
    label: '돈',
    question: '돈이 모이지 않는 패턴',
    productName: '재물 흐름 풀이',
    reportAnswer: '돈이 들어오는 방식보다 새는 지점과 지켜야 할 루틴을 먼저 정리합니다.',
    href: '/saju/new?focus=wealth',
  },
  {
    slug: 'career',
    label: '일',
    question: '이직해도 되는 시기',
    productName: '일과 자리 풀이',
    reportAnswer: '버텨야 할 때와 옮겨야 할 때를 역할, 대운, 올해 흐름으로 구분합니다.',
    href: '/saju/new?focus=career',
  },
  {
    slug: 'family',
    label: '가족',
    question: '가족과 부딪히는 이유',
    productName: '가족 관계 풀이',
    reportAnswer: '부모, 자녀, 배우자 사이에서 반복되는 말과 역할의 엇갈림을 봅니다.',
    href: '/saju/new?focus=family',
  },
  {
    slug: 'year',
    label: '올해 흐름',
    question: '올해 진행하기 좋은 달',
    productName: '올해 전략 풀이',
    reportAnswer: '좋은 달, 한 번 더 확인할 달, 차분히 정리할 달을 먼저 지도처럼 보여줍니다.',
    href: '/saju/new?focus=year',
  },
  {
    slug: 'today',
    label: '오늘 조언',
    question: '오늘 무엇을 조심하면 좋을까',
    productName: '오늘 흐름 미리보기',
    reportAnswer: '오늘의 한 줄, 조심할 패턴, 지금 할 행동 하나를 짧게 정리합니다.',
    href: '/today-fortune?concern=general',
  },
] as const;

export const REPORT_PREVIEW_VALUE_POINTS = [
  {
    title: '결과 예시 1장',
    body: '한 줄 총평, 분야 카드, 다음 행동을 바로 보여드립니다.',
  },
  {
    title: '답하는 질문',
    body: '연애, 돈, 일, 가족, 올해 흐름처럼 사용자가 실제로 묻는 질문을 기준으로 리포트를 고릅니다.',
  },
  {
    title: '소장하면 남는 것',
    body: '명식, 격국, 용신, 대운의 기준을 PDF와 MY 보관함에 남겨 다시 읽을 수 있습니다.',
  },
  {
    title: '대화 연결',
    body: '풀이를 읽은 뒤 같은 흐름 위에서 간지사주에게 이어서 질문할 수 있습니다.',
  },
] as const;

export const TASTE_PRODUCTS: readonly MoonlightTasteProduct[] = [
  {
    slug: 'today-detail',
    title: '오늘 자세히 보기',
    price: '550원',
    question: '오늘 무엇을 조심하면 좋을까',
    result: '무료 결과에서 걸린 부분만 조금 더 짧게 봅니다.',
    href: '/today-fortune?concern=general&product=today-detail',
    status: '오늘운 결과 후 연결',
    teacherSlug: 'saju-yong',
  },
  {
    slug: 'love-question',
    title: '연애 마음 확인',
    price: '990원',
    question: '상대와 다시 이어질 수 있을까',
    result: '상대의 속도, 내 마음, 다시 말 걸 타이밍을 짧게 봅니다.',
    href: '/membership/checkout?product=love-question&from=taste-product',
    status: '연애 질문으로 연결',
    teacherSlug: 'compat-yang',
    compatibilityOnly: true,
  },
  {
    slug: 'money-pattern',
    title: '돈이 새는 패턴',
    price: '990원',
    question: '왜 돈이 잘 모이지 않을까',
    result: '돈이 들어오는 말보다, 지켜야 할 습관을 먼저 봅니다.',
    href: '/saju/new?focus=wealth&product=money-pattern',
    status: '재물 질문으로 연결',
    teacherSlug: 'myeongri-ho',
  },
  {
    slug: 'work-flow',
    title: '일/직장 흐름',
    price: '990원',
    question: '지금 버틸까, 움직일까',
    result: '오늘의 역할, 말의 강도, 일에서 조심할 장면을 짧게 봅니다.',
    href: '/saju/new?focus=career&product=work-flow',
    status: '일 질문으로 연결',
    teacherSlug: 'myeongri-ho',
  },
  {
    slug: 'monthly-calendar',
    title: '월간 달력',
    price: '1,900원',
    question: '이번 달 좋은 날과 조심할 날은 언제일까',
    result: '좋은 날, 한 번 더 확인할 날, 차분히 정리할 날을 달력처럼 봅니다.',
    href: '/saju/new?product=monthly-calendar',
    status: '사주 결과 생성 후 연결',
    teacherSlug: 'today-so',
  },
  {
    slug: 'year-core',
    title: '올해 핵심 3줄',
    price: '3,900원',
    question: '올해 무엇을 해보고, 무엇을 조심할까',
    result: '올해의 핵심 주제, 주의 패턴, 진행하기 좋은 달을 짧게 정리합니다.',
    href: '/saju/new?product=year-core',
    status: '사주 결과 생성 후 연결',
    teacherSlug: 'myeongri-ho',
  },
] as const;

const DALBIT_TEACHER_GUIDE_HREF = '/guide?teacher=';

export const DALBIT_TEACHERS: readonly DalbitTeacherCard[] = [
  {
    slug: 'mg-ji',
    teacherName: '엠지쥐선생',
    animal: '쥐',
    zodiac: '🐭',
    zodiacOrder: 1,
    serviceTitle: 'MBTI',
    shortLabel: '성향 놀이',
    role: '가벼운 성향 테스트와 운세를 연결하는 확장 메뉴입니다.',
    question: '나는 어떤 말투와 관계 방식에 가까울까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}mg-ji`,
    productPosition: '무료 성향 테스트와 소액 궁금증 상품으로 확장 예정입니다.',
    status: 'active',
  },
  {
    slug: 'today-so',
    teacherName: '오늘소선생',
    animal: '소',
    zodiac: '🐮',
    zodiacOrder: 2,
    serviceTitle: '오늘 루틴',
    shortLabel: '생활 조언',
    role: '오늘의 운세를 생활 리듬, 습관, 작은 실천으로 바꾸는 확장 메뉴입니다.',
    question: '오늘 하루를 편하게 넘기려면 무엇부터 하면 좋을까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}today-so`,
    productPosition: '출석, 루틴, 무료 오늘 조언, 리워드 흐름으로 확장 예정입니다.',
    status: 'active',
  },
  {
    slug: 'myeongri-ho',
    teacherName: '명리호선생',
    animal: '호랑이',
    zodiac: '🐯',
    zodiacOrder: 3,
    serviceTitle: '명리',
    shortLabel: '조금 더 깊게',
    role: '돈, 일, 반복되는 선택처럼 조금 더 깊게 봐야 할 문제를 정리합니다.',
    question: '왜 이 패턴이 자꾸 반복될까?',
    href: '/myeongri',
    productPosition: '돈이 새는 패턴 990원, 일/직장 흐름 990원과 연결됩니다.',
    status: 'active',
  },
  {
    slug: 'tarot-to',
    teacherName: '타로토선생',
    animal: '토끼',
    zodiac: '🐰',
    zodiacOrder: 4,
    serviceTitle: '타로',
    shortLabel: '지금 마음 보기',
    role: '카드 한 장으로 지금 마음, 망설임, 오늘 해볼 행동을 빠르게 보여줍니다.',
    question: '지금 내 마음은 어디로 기울어 있을까?',
    href: '/tarot/daily',
    productPosition: '무료 타로에서 시작하고, 마음이 남으면 990원 풀이로 이어집니다.',
    status: 'active',
  },
  {
    slug: 'saju-yong',
    teacherName: '사주용선생',
    animal: '용',
    zodiac: '🐲',
    zodiacOrder: 5,
    serviceTitle: '사주',
    shortLabel: '내 흐름 보기',
    role: '생년월일과 태어난 시간을 바탕으로 오늘과 올해의 큰 흐름을 짚습니다.',
    question: '나는 지금 어떤 흐름 위에 있을까?',
    href: '/saju/new',
    productPosition: '무료 사주, 오늘 자세히 보기 550원, 긴 사주풀이로 이어집니다.',
    status: 'active',
  },
  {
    slug: 'dream-baem',
    teacherName: '꿈뱀선생',
    animal: '뱀',
    zodiac: '🐍',
    zodiacOrder: 6,
    serviceTitle: '꿈해몽',
    shortLabel: '마음 신호',
    role: '꿈에 남은 장면을 무의식, 감정, 오늘의 조심 포인트로 풀어내는 확장 메뉴입니다.',
    question: '어젯밤 꿈은 지금 마음의 어떤 신호일까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}dream-baem`,
    productPosition: '무료 꿈 키워드 해석과 990원 자세히 보기로 확장 예정입니다.',
    status: 'active',
  },
  {
    slug: 'move-mal',
    teacherName: '이동말선생',
    animal: '말',
    zodiac: '🐴',
    zodiacOrder: 7,
    serviceTitle: '이동운',
    shortLabel: '이직·이사·여행',
    role: '움직여도 되는 시기, 방향, 이직과 이사의 부담을 가볍게 확인하는 확장 메뉴입니다.',
    question: '지금 움직여도 괜찮을까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}move-mal`,
    productPosition: '이직, 이사, 여행, 방향 질문형 990원 상품으로 확장 예정입니다.',
    status: 'active',
  },
  {
    slug: 'compat-yang',
    teacherName: '궁합양선생',
    animal: '양',
    zodiac: '🐑',
    zodiacOrder: 8,
    serviceTitle: '궁합',
    shortLabel: '상대와의 결',
    role: '나와 상대의 속도, 거리감, 부딪히는 말을 관계 중심으로 풀어줍니다.',
    question: '이 사람과 다시 잘 맞출 수 있을까?',
    href: '/compatibility/input',
    productPosition: '연애 마음 확인 990원, 궁합 입력, 관계 풀이로 이어집니다.',
    status: 'active',
  },
  {
    slug: 'face-won',
    teacherName: '관상원선생',
    animal: '원숭이',
    zodiac: '🐵',
    zodiacOrder: 9,
    serviceTitle: '관상',
    shortLabel: '인상과 분위기',
    role: '관상과 첫인상 풀이를 안전한 표현 기준 안에서 확장할 메뉴입니다.',
    question: '내 인상은 어떤 분위기로 전해질까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}face-won`,
    productPosition: '사진/자가진단 기반 무료 입구와 소액 풀이로 확장 예정입니다.',
    status: 'active',
  },
  {
    slug: 'wealth-dak',
    teacherName: '재물닭선생',
    animal: '닭',
    zodiac: '🐔',
    zodiacOrder: 10,
    serviceTitle: '재물운',
    shortLabel: '돈 습관',
    role: '소비, 저축, 돈이 새는 장면을 더 직관적으로 보여주는 재물 특화 확장 메뉴입니다.',
    question: '돈이 새는 지점은 어디일까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}wealth-dak`,
    productPosition: '재물 질문, 소비 패턴, 월간 돈 흐름 상품으로 확장 예정입니다.',
    status: 'active',
  },
  {
    slug: 'palm-meong',
    teacherName: '손금멍선생',
    animal: '개',
    zodiac: '🐶',
    zodiacOrder: 11,
    serviceTitle: '손금',
    shortLabel: '손바닥 단서',
    role: '이미지 기반 손금 풀이로 확장할 수 있는 예정 메뉴입니다.',
    question: '내 손에는 어떤 생활 단서가 보일까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}palm-meong`,
    productPosition: '사진 입력형 무료 맛보기와 990원 자세히 보기로 확장 예정입니다.',
    status: 'active',
  },
  {
    slug: 'luck-dwaeji',
    teacherName: '복돼지선생',
    animal: '돼지',
    zodiac: '🐷',
    zodiacOrder: 12,
    serviceTitle: '행운',
    shortLabel: '복·쿠폰·리워드',
    role: '출석, 행운 카드, 쿠폰, 카카오 친구 유도 같은 리워드 흐름을 맡는 확장 메뉴입니다.',
    question: '오늘 받을 수 있는 작은 행운은 무엇일까?',
    href: `${DALBIT_TEACHER_GUIDE_HREF}luck-dwaeji`,
    productPosition: '출석 리워드, 무료 행운 카드, 쿠폰 안내로 확장 예정입니다.',
    status: 'active',
  },
] as const;

export const ACTIVE_DALBIT_TEACHERS = DALBIT_TEACHERS.filter(
  (teacher) => teacher.status === 'active'
);

export const COMING_SOON_DALBIT_TEACHERS = DALBIT_TEACHERS.filter(
  (teacher) => teacher.status === 'coming-soon'
);

export const TRUST_SIGNALS = [
  {
    title: '저장됨',
    body: '한 번 연 결과는 MY 보관함에서 다시 찾을 수 있게 설계합니다.',
  },
  {
    title: '다시 볼 수 있음',
    body: '해금한 리포트와 달력은 재열람을 전제로 안내합니다.',
  },
  {
    title: '다시 확인 가능',
    body: '중요한 결과는 보관함에서 다시 확인할 수 있습니다.',
  },
  {
    title: '시간·출생지 기준',
    body: '태어난 시간과 출생지 기준은 결과에서 확인 가능한 정보로 남깁니다.',
  },
  {
    title: '공포 표현 없음',
    body: '대흉, 반드시 실패 같은 단정 대신 참고 흐름과 생활 행동으로 말합니다.',
  },
] as const;

export const WISDOM_CARDS: readonly MoonlightWisdomCard[] = [
  {
    slug: 'saju',
    hanja: '🐲',
    title: '사주',
    hook: '나는 어떤 사람으로 태어난 걸까',
    description: '태어난 때에 깃든 하늘의 결을 읽어, 선생님의 본성과 큰 흐름을 차분히 짚어드립니다.',
    href: '/saju/new',
    tone: 'gold',
  },
  {
    slug: 'myeongri',
    hanja: '🐯',
    title: '명리',
    hook: '왜 유독 이 부분에서 늘 걸리는 걸까',
    description: '오행과 십신의 움직임으로, 자꾸 반복되는 삶의 장면이 왜 생기는지 들려드립니다.',
    href: '/myeongri',
    tone: 'goldSoft',
  },
  {
    slug: 'tarot',
    hanja: '🐰',
    title: '타로',
    hook: '지금 이 선택, 괜찮은 걸까',
    description: '지금 이 순간 마음 위로 스치는 기운을 한 장의 그림으로 읽어드립니다.',
    href: '/tarot/daily',
    tone: 'plum',
  },
  {
    slug: 'compatibility',
    hanja: '🐑',
    title: '궁합',
    hook: '우리, 정말 잘 맞는 사이일까',
    description: '두 사람의 결이 어디에서 닮고 어디에서 어긋나는지, 살가운 말로 풀어드립니다.',
    href: '/compatibility',
    tone: 'jade',
  },
  {
    slug: 'star-sign',
    hanja: '✦',
    title: '별자리',
    hook: '저 먼 별빛이 내게 전하는 말',
    description: '오늘 마음의 결을 별빛 언어로 먼저 살피고, 사주와 만나는 지점까지 이어드립니다.',
    href: '/star-sign',
    tone: 'sky',
  },
  {
    slug: 'zodiac',
    hanja: '🐾',
    title: '띠별 운세',
    hook: '올해 내 띠의 흐름은 어떠한가',
    description: '익숙한 띠의 흐름으로 오늘과 올 한 해의 기운을 부드럽게 짚어드립니다.',
    href: '/zodiac',
    tone: 'coral',
  },
] as const;

export const HOME_TODAY_SUMMARY = [
  { label: '재물', value: '안정', ratio: 65, tone: 'gold' as const },
  { label: '건강', value: '가뿐', ratio: 80, tone: 'jade' as const },
  { label: '관계', value: '조율', ratio: 50, tone: 'sky' as const },
] as const;

export const INTERPRETATION_LAYERS = [
  {
    title: '깊이 헤아리는 해석',
    body: '사주와 명리는 태어난 바탕과 오래 이어지는 흐름을 읽어, “나는 왜 이럴까”라는 물음에 천천히 답합니다.',
    items: ['사주 원국과 일간의 본질', '오행 균형과 격국 해석', '용신, 대운, 세운 중심 심화 리포트'],
  },
  {
    title: '지금 마음에 닿는 해석',
    body: '타로와 궁합은 오늘의 선택과 관계를 가까운 말로 풀어, 막연한 마음을 조금 더 또렷하게 정리해드립니다.',
    items: ['질문별 타로 리딩', '연인·배우자·가족 궁합', '사주와 타로의 교차 해석'],
  },
  {
    title: '가볍게 펼쳐보는 운세',
    body: '별자리와 띠운세는 익숙한 언어로 오늘의 리듬을 먼저 보여드리는 친숙한 길입니다.',
    items: ['오늘의 별자리', '12띠 연운과 월운', '서양·동양 관점 크로스'],
  },
] as const;

export const SAJU_BASIC_SECTIONS = [
  {
    slug: 'nature',
    title: '타고난 성정',
    description: '나는 어떤 기질로 태어났는가',
  },
  {
    slug: 'elements',
    title: '오행 균형',
    description: '내 안에 무엇이 강하고 무엇이 부족한가',
  },
  {
    slug: 'today',
    title: '오늘의 흐름',
    description: '지금 이 순간 하늘의 메시지',
  },
] as const;

export const SAJU_PREMIUM_SECTIONS = [
  '일주 본질',
  '오행 균형',
  '성향 구조',
  '필요한 보완',
  '큰 흐름',
  '2026 세운',
  '분야별 조망',
] as const;

export const COMPATIBILITY_RELATIONSHIPS: readonly CompatibilityRelationship[] = [
  {
    slug: 'lover',
    icon: '💑',
    title: '연인 · 배우자',
    hook: '우리, 정말 잘 맞는 사이일까',
  },
  {
    slug: 'family',
    icon: '👨‍👩‍👧',
    title: '부모 · 자녀',
    hook: '왜 저 아이와는 늘 부딪힐까',
  },
  {
    slug: 'friend',
    icon: '🤝',
    title: '형제 · 친구',
    hook: '오래도록 편한 사이일까',
  },
  {
    slug: 'partner',
    icon: '💼',
    title: '동업 · 파트너',
    hook: '함께 일해도 괜찮을 사이일까',
  },
] as const;

export const COMPATIBILITY_RESULT_LABELS = [
  '하늘이 맺어준 인연',
  '조화로운 인연',
  '노력으로 깊어질 인연',
  '서로의 다름을 배우는 인연',
  '이해로 품는 인연',
] as const;

export const DIALOGUE_PRESETS: readonly MoonlightDialoguePreset[] = [
  {
    category: '재물',
    question: '올해 재물 흐름은 어떤가요?',
    previewAnswer:
      '올해는 큰 한 번보다 새는 지출을 먼저 정리하실 때 재물운이 안정되는 흐름입니다. 들어오는 돈의 크기보다 남는 돈의 구조를 다듬는 편이 더 중요합니다.',
    followUp: '지금 지출부터 손봐야 할지, 새로운 기회를 잡아야 할지 이어서 여쭤보실 수 있습니다.',
  },
  {
    category: '가족',
    question: '큰 며느리와는 어떤 인연인가요?',
    previewAnswer:
      '가까운 가족 궁합은 좋고 나쁨보다 말의 온도와 기대하는 역할이 더 중요합니다. 두 분은 기본 인연은 이어지지만, 표현의 강약을 조절할 때 훨씬 편안해지는 관계로 읽힙니다.',
    followUp: '서운함이 커지는 이유나 대화 타이밍까지 더 물어보실 수 있습니다.',
  },
  {
    category: '이동',
    question: '이사를 하려는데 방향은 어떻게?',
    previewAnswer:
      '방향 질문은 사주의 길흉만 단정하지 않고, 현재 생활 리듬과 가족 흐름을 함께 봐야 합니다. 지금은 서두르기보다 몸이 편안해지는 방향과 생활 동선을 함께 맞춰보는 편이 좋습니다.',
    followUp: '이사 시기와 함께 보면 더 구체적인 답변으로 이어집니다.',
  },
  {
    category: '가족',
    question: '아이의 진로에 도움이 될 이야기',
    previewAnswer:
      '진로는 운보다 기질을 먼저 보는 편이 오래 갑니다. 아이가 힘을 얻는 방식과 지치기 쉬운 방식을 먼저 읽고, 그다음 올해 흐름이 어느 쪽에 힘을 실어주는지 차분히 연결해드립니다.',
    followUp: '학업, 취업, 전환 중 어떤 고민인지 더 말씀해주시면 답이 선명해집니다.',
  },
  {
    category: '마음',
    question: '요즘 왜 이리 마음이 어수선할까요',
    previewAnswer:
      '마음이 어수선할 때는 사건보다 내 안의 리듬이 먼저 흐트러진 경우가 많습니다. 사주에서는 지금 외부 자극이 많은 구간인지, 쉬어야 하는 구간인지를 함께 읽어 불안을 작은 실천으로 바꿔드립니다.',
    followUp: '잠, 관계, 건강 중 어디에서 가장 먼저 흔들리는지도 이어서 보실 수 있습니다.',
  },
  {
    category: '재물',
    question: '은퇴 자금 관리에 도움될 이야기',
    previewAnswer:
      '은퇴 자금은 큰 수익보다 오래 지키는 흐름이 더 중요합니다. 지금은 공격적으로 불리기보다 새는 지출과 불안한 선택을 줄여 마음 편한 구조를 만드는 쪽이 먼저로 보입니다.',
    followUp: '투자, 부동산, 생활비 구조 중 무엇이 가장 걱정되는지 더 말씀해주시면 좋습니다.',
  },
  {
    category: '건강·생활',
    question: '요즘 몸이 피곤한데, 흐름상 어떤가요?',
    previewAnswer:
      '몸의 피로는 사주 해석으로 진단하지 않지만, 생활 리듬이 무너지는 구간인지 살펴 생활 조절 포인트를 드릴 수 있습니다. 다만 증상 판단은 꼭 의료진과 함께 보시는 편이 안전합니다.',
    followUp: '수면, 식사, 스트레스 중 어디가 먼저 무너지는지 기준으로 생활 팁을 이어드릴 수 있습니다.',
  },
  {
    category: '이동',
    question: '여행 가기 좋은 시기',
    previewAnswer:
      '여행운은 크게 나쁜 날을 피하기보다 몸과 마음이 풀리는 시기를 고르는 것이 핵심입니다. 지금은 무리한 일정보다 가까운 곳에서 숨 고를 수 있는 흐름이 더 잘 맞아 보입니다.',
    followUp: '국내인지 해외인지, 혼자인지 가족과 함께인지에 따라 더 다르게 읽어드릴 수 있습니다.',
  },
  {
    category: '마음',
    question: '무엇이 나를 이렇게 불안하게 할까요',
    previewAnswer:
      '불안은 한 가지 사건보다 오래 쌓인 피로와 관계 압박이 겹쳐질 때 커집니다. 대화에서는 선생님의 사주를 바탕으로 어디에서 에너지가 새는지 짚고, 오늘 바로 줄일 수 있는 실천까지 연결합니다.',
    followUp: '다만 위기감이 크거나 삶을 놓고 싶다는 마음이 드신다면 해석보다 안전 자원을 먼저 안내드립니다.',
  },
  {
    category: '생활',
    question: '이번 달 조심할 점',
    previewAnswer:
      '이번 달은 무리해서 한 번에 해결하려는 마음만 줄여도 훨씬 편안해질 수 있습니다. 관계와 재물 모두 속도를 낮추고, 말과 지출의 강약을 조절하는 것이 가장 큰 포인트입니다.',
    followUp: '재물, 관계, 건강 중 어느 쪽을 특히 조심하면 좋을지 더 좁혀서 보실 수 있습니다.',
  },
] as const;

export const DIALOGUE_GUARDRAILS = [
  {
    title: '마음을 먼저 듣습니다',
    body: '답을 서둘러 내리기보다, 지금 어떤 마음으로 여쭈셨는지 먼저 헤아리는 말투를 지킵니다.',
  },
  {
    title: '오늘의 실마리까지',
    body: '듣기 좋은 말로 끝내지 않고, 오늘 바로 해보실 수 있는 작은 실천 하나까지 함께 정리합니다.',
  },
  {
    title: '위험한 질문은 안전 안내로',
    body: '자해·극단 선택·응급 의료·법률·투자처럼 더 안전한 도움이 필요한 문제는 선을 넘지 않고 알맞은 도움처로 모십니다.',
  },
] as const;

export const SAFE_REDIRECT_RESOURCES = [
  {
    category: 'crisis',
    label: '자살예방 상담전화 109',
    phone: '109',
    detail: '대한민국 24시간 상담 · 국번 없이 연결',
    note: '마음이 위험한 순간에는 전문 상담사와 바로 이야기 나누실 수 있습니다.',
  },
  {
    category: 'crisis-us',
    label: '988 Suicide & Crisis Lifeline',
    phone: '988',
    detail: '미국/미국령 24시간 통화 · 문자 · 채팅',
    note: '미국에서 즉시 위기 지원이 필요하면 988, 생명이 급한 응급상황이면 911로 연결하세요.',
  },
  {
    category: 'medical',
    label: '의료 상담 안내',
    phone: '병원 찾기',
    detail: '증상 판단은 의료진과 상의',
    note: '사주 해석은 참고만 두고 실제 진료를 권합니다.',
  },
  {
    category: 'financial',
    label: '금융감독원',
    phone: '1332',
    detail: '불법 사금융 · 투자 피해 상담',
    note: '투자 판단은 금융 전문가와 상의하시는 편이 안전합니다.',
  },
  {
    category: 'legal',
    label: '대한법률구조공단',
    phone: '132',
    detail: '법률 구조 상담',
    note: '관계 흐름은 보되 법적 판단은 전문가 상담으로 이어드립니다.',
  },
  {
    category: 'fertility',
    label: '난임·임신 상담',
    phone: '1670-6230',
    detail: '전문 상담 연결',
    note: '마음의 부담을 덜고 의료 상담과 함께 보실 수 있습니다.',
  },
  {
    category: 'grief',
    label: '호스피스 상담',
    phone: '1577-8899',
    detail: '사별·상실 지원',
    note: '깊은 애도는 혼자 감당하지 않도록 지속 지원 자원을 안내합니다.',
  },
] as const;

export const ONBOARDING_THOUGHTS = [
  '요즘따라 왜 이렇게 마음이 어수선할까',
  '자녀와 나, 정말 맞는 사이일까',
  '올해는 어떤 해가 되려나',
] as const;

export const ONBOARDING_CONSENTS = [
  {
    title: '개인정보 수집·이용',
    detail: '사주 계산 목적 · 탈퇴 시 30일 내 파기',
    required: true,
  },
  {
    title: 'AI 모델 전송 동의',
    detail: '해석 생성을 위해 AI에 전송 · 학습에 사용되지 않음',
    required: true,
  },
  {
    title: '서비스 이용약관',
    detail: '결제와 환불, 저장형 콘텐츠 이용 조건 안내',
    required: true,
  },
  {
    title: '소식 받아보기',
    detail: '매월 첫째 주 새 기능과 이벤트 안내',
    required: false,
  },
] as const;

export const ONBOARDING_TONE_OPTIONS: readonly MoonlightToneOption[] = [
  {
    value: 'friendly',
    label: '친근하게',
    description: '가깝고 다정한 표현으로 먼저 말을 건넵니다.',
  },
  {
    value: 'polite',
    label: '정중하게',
    description: '기본 추천값입니다. 시니어 친화 톤으로 차분히 안내합니다.',
  },
  {
    value: 'standard',
    label: '표준',
    description: '정보 위주로 담백하게 정리해 드립니다.',
  },
] as const;

export const NOTIFICATION_SCHEDULE_BLUEPRINT: readonly MoonlightNotificationSlot[] = [
  {
    key: 'today-fortune',
    title: '오늘의 운세',
    body: '오늘의 운세가 준비됐어요. 핵심 한 줄과 조심할 점만 짧게 확인해 보세요.',
    timeLabel: '오전 8시',
    cadence: '매일',
    tone: 'plum',
  },
  {
    key: 'today-tarot',
    title: '오늘의 타로',
    body: '오늘 마음에 필요한 타로 한 장을 뽑아보세요.',
    timeLabel: '낮 12시',
    cadence: '매일',
    tone: 'plum',
  },
  {
    key: 'today-zodiac',
    title: '오늘의 띠운세',
    body: '내 띠 기준 오늘 흐름을 가볍게 확인해 보세요.',
    timeLabel: '오후 8시',
    cadence: '매일',
    tone: 'plum',
  },
  {
    key: 'today-star-sign',
    title: '오늘의 별자리',
    body: '서양 별자리 오늘 운세 — 내 별자리의 한 줄과 점수를 확인해 보세요.',
    timeLabel: '아침 9시',
    cadence: '매일',
    tone: 'plum',
  },
  {
    key: 'subscription-expiring',
    title: '멤버십 만료 임박',
    body: '곧 멤버십이 만료됩니다. 지금 연장하시면 끊김 없이 이어 사용하실 수 있어요.',
    timeLabel: '오전 10시',
    cadence: 'D-7 / D-3 / D-day',
    tone: 'coral',
  },
  {
    key: 'comeback-reminder',
    title: '오랜만이에요',
    body: '오늘 운세 한 줄과 새로운 흐름을 가볍게 확인해 보세요.',
    timeLabel: '저녁 7시',
    cadence: '미접속 N일 (사용자 설정)',
    tone: 'plum',
  },
] as const;

export const HOME_WIDGET_BLUEPRINT: readonly MoonlightWidgetBlueprint[] = [
  {
    size: 'small',
    title: '작은 위젯 (2×2)',
    summary: '오늘의 한 줄과 행운 요소 2개를 한눈에 보여줍니다.',
    details: ['오늘의 한 줄', '행운 색상', '행운 숫자'],
  },
  {
    size: 'medium',
    title: '중간 위젯 (4×2)',
    summary: '한 줄, 사주 요약, 운세 게이지를 함께 보여줍니다.',
    details: ['오늘의 한 줄', '일간·오행 요약', '재물·건강·관계 게이지'],
  },
  {
    size: 'large',
    title: '큰 위젯 (4×4)',
    summary: '다음 마일스톤으로, 여섯 지혜 카드를 모두 펼쳐 보여주는 확장형입니다.',
    details: ['사주 심화 카드', '궁합·타로 바로가기', '오늘의 전체 리듬'],
  },
] as const;

export const RETENTION_SCENARIOS: readonly MoonlightRetentionScenario[] = [
  {
    trigger: '3일 미접속',
    action: '오늘의 한 줄과 함께 부드러운 재방문 리마인더 발송',
    purpose: '끊기기 쉬운 초반 루틴을 다시 잇기',
  },
  {
    trigger: '주간 시작',
    action: '월요일 오전 주간 세운 알림 발송',
    purpose: '주간 루틴과 저장한 결과 재열람 유도',
  },
  {
    trigger: '절기 변경',
    action: '절기 해설과 함께 계절 리듬 카드 노출',
    purpose: '명리 해석의 신뢰감과 재방문 이유 강화',
  },
  {
    trigger: '생일',
    action: '새 한 해 리듬 요약과 자세히 보기 진입 제안',
    purpose: '의미 있는 개인 이벤트를 유료 전환 지점으로 연결',
  },
] as const;

// 2026-05-15 — MY 메뉴 라벨 명확화.
// "가족 사주" → "가족·다른 사람 정보" (가족 외 사람도 같은 풀에서 관리됨을 명시).
// "내 정보 편집" 진입점 신설 (프로필 편집은 가족 정보와 분리해 직접 접근 가능하게).
export const MY_MENU_BLUEPRINT = [
  {
    title: '내 정보 편집',
    description: '이름·생년월일·시간 룰 수정',
    href: '/my/profile',
  },
  {
    title: '내 사주 원국',
    description: '언제든 다시 살펴보기',
    href: '/my/results',
  },
  {
    title: '저장한 해석',
    description: '마음에 드셨던 이야기들',
    href: '/my/results',
  },
  {
    title: '가족·다른 사람 정보',
    description: '가족·연인·친구 사주 함께 관리',
    href: '/my/profile#family',
  },
  {
    // 2026-05-16 PR #151 — 사용자 default situation 분리 메뉴.
    title: '내 현재 상황',
    description: '연애·직업·고민 저장 → 풀이 자동 반영',
    href: '/my/situation',
  },
  {
    // 2026-05-15 — 대화 채팅 기록 진입점 신설.
    title: '대화 기록',
    description: '선생님과 나눈 대화 다시 보기',
    href: '/dialogue/history',
  },
  {
    title: '대화 플랜',
    description: '이용 기간과 혜택 관리하기',
    href: '/membership',
  },
  {
    title: '알림 센터',
    description: '푸시 · 위젯 · 재방문 루틴 관리',
    href: '/notifications',
  },
  {
    title: '설정',
    description: '글자 · 말투 · 레이아웃',
    href: '/my/settings',
  },
  {
    title: '문의',
    description: '바로 물어보기',
    href: '/dialogue',
  },
] as const;

export const PLAN_BLUEPRINT = [
  {
    slug: 'basic' as const,
    title: '라이트 대화 멤버십',
    price: '월 4,900원',
    badge: '대화로 가볍게 시작',
    summary: '짧은 질문과 오늘의 흐름을 조용히 이어보는 가장 가벼운 대화용 플랜입니다.',
    features: ['매일 해석 10회', '사주풀이 미리보기 월 2회', '대화 상담 월 30턴', '보관함 다시 보기'],
    fit: '지금 궁금한 질문을 가볍게 이어 묻고 싶은 분',
    opens: ['마음이 흔들릴 때 짧게 여쭙는 대화', '월 2회 긴 사주풀이 미리보기', '광고 없이 차분히 읽는 해석'],
  },
  {
    slug: 'premium' as const,
    title: '프리미엄 대화 멤버십',
    price: '월 9,900원',
    badge: '질문을 계속 이어가는 중심 플랜',
    summary: '사주, 궁합, 가족 이야기, 오늘의 흐름까지 생활 가까운 질문을 넉넉하게 이어보는 대화 중심 구독 플랜입니다.',
    features: ['매일 해석 30회', '궁합 분석 월 3회', '가족 사주 5명', '긴 사주풀이 미리보기 월 10회', '대화 상담 월 120턴'],
    fit: '풀이를 읽은 뒤 계속 질문하며 생활에 붙여 쓰고 싶은 분',
    opens: ['궁합과 가족 사주를 넉넉히 펼쳐보기', '긴 사주풀이 미리보기 월 10회', '대화 상담 월 120턴과 공정사용정책'],
  },
  {
    slug: 'lifetime' as const,
    title: '보관형 사주 리포트',
    price: '49,000원',
    badge: '한 번 결제 · 평생 소장',
    summary: '원국, 격국, 용신, 대운을 한 권의 보관형 리포트로 남기는 소장형 상품입니다.',
    features: ['7개 섹션 완성형 풀이', 'PDF 다운로드', 'MY 보관함 저장', '평생 무료 업데이트'],
    fit: '한 번의 결제로 내 명리 기준을 오래 보관하고 싶은 분',
    opens: ['격국·용신·대운을 한 권의 보관형 풀이로', 'PDF와 MY 보관함으로 오래 남기기', '해석이 다듬어질 때 다시 펼쳐보기'],
  },
] as const;

export const INTERPRETATION_ENTRY_GUIDE = [
  {
    title: '마음의 바탕이 궁금하시면 사주부터',
    body: '생년월일을 바탕으로 타고난 기질, 오행의 균형, 지금의 흐름을 가장 차분히 읽어드립니다.',
    href: '/saju/new',
    cta: '사주 시작하기',
  },
  {
    title: '사람 사이의 온도가 궁금하시면 궁합',
    body: '가족, 연인, 가까운 인연 사이에서 왜 마음이 엇갈리는지, 어디서 다시 다정해질 수 있는지 살펴봅니다.',
    href: '/compatibility',
    cta: '궁합 보기',
  },
  {
    title: '오늘 마음이 먼저 움직이신다면 타로',
    body: '질문 하나와 카드 한 장으로 지금의 감정선을 비추고, 필요하면 더 깊은 사주 해석으로 이어집니다.',
    href: '/tarot/daily',
    cta: '타로 뽑기',
  },
] as const;

export const INTERPRETATION_JOURNEY = [
  {
    title: '1. 먼저 가볍게 펼쳐봅니다',
    body: '부담 없는 첫 해석으로 지금 마음에 닿는 이야기를 먼저 만나봅니다.',
  },
  {
    title: '2. 마음에 남는 장면을 간직합니다',
    body: '다시 읽고 싶은 결과는 MY에 차곡차곡 모아, 가족 이야기나 올해의 흐름과 이어 봅니다.',
  },
  {
    title: '3. 필요할 때 더 깊이 들어갑니다',
    body: '격국, 용신, 대운처럼 오래 품고 볼 내용은 보관형 사주 리포트로 차분히 열어드립니다.',
  },
] as const;

export const SAJU_PREMIUM_PREVIEW = [
  {
    title: '격국이 보여주는 평생의 역할',
    body: '선생님이 어떤 자리에서 가장 힘을 발휘하시는지, 오래 쌓아온 역할감이 어디에서 빛나는지를 읽어드립니다.',
  },
  {
    title: '용신이 알려주는 균형 회복 포인트',
    body: '무엇을 더하고 무엇을 덜어야 편안해지는지, 생활 습관과 관계의 결까지 연결해 설명합니다.',
  },
  {
    title: '대운·세운이 답하는 지금의 타이밍',
    body: '원래 타고난 성향과 별개로 왜 유독 지금 흔들리는지, 혹은 왜 지금 기회가 열리는지 시기 언어로 읽습니다.',
  },
] as const;

export const SAJU_PREMIUM_VALUE_POINTS = [
  '원국만 설명하는 데서 멈추지 않고, 강약과 격국을 함께 엮어 보관형 풀이로 정리합니다.',
  '현재 대운과 세운을 붙여 “왜 지금 이런가”를 한 화면에서 읽게 합니다.',
  'PDF와 MY 보관함에 함께 남아, 이후 월운과 대화도 같은 기준 위에서 이어집니다.',
] as const;

export const COMPATIBILITY_DEEPENING_PREVIEW = [
  {
    title: '갈등이 반복되는 이유',
    body: '서로 상처받는 말투와 반응 순서를 짚어, 왜 비슷한 장면이 반복되는지 설명합니다.',
  },
  {
    title: '가까워지는 방식',
    body: '상대가 위로를 느끼는 말과 거리 두기를 원하는 순간을 읽어 관계의 온도를 조절하게 돕습니다.',
  },
  {
    title: '올해 두 분의 대화 타이밍',
    body: '올해와 이번 달 흐름을 겹쳐 어떤 때에 말하고, 어떤 때에 기다리는 편이 좋은지 읽습니다.',
  },
] as const;

export const COMPATIBILITY_PREMIUM_EXPANSION: Record<
  CompatibilityRelationshipSlug,
  {
    ctaTitle: string;
    ctaBody: string;
    preview: readonly { title: string; body: string }[];
  }
> = {
  lover: {
    ctaTitle: '연인 · 배우자는 감정의 타이밍까지 읽을 때 가장 또렷합니다',
    ctaBody:
      '좋아하는 마음과 서운함이 언제 엇갈리는지, 연락과 표현의 속도를 어떻게 맞추면 좋은지까지 프리미엄에서 더 구체적으로 이어집니다.',
    preview: [
      {
        title: '서운함이 커지는 순간',
        body: '누가 먼저 표현을 원하고, 누가 먼저 시간을 벌고 싶어 하는지 짚어 감정 충돌의 순서를 읽습니다.',
      },
      {
        title: '관계가 가까워지는 대화법',
        body: '상대가 안심을 느끼는 말투와 선생님의 진심이 잘 전달되는 타이밍을 함께 정리합니다.',
      },
      {
        title: '올해 관계 진전 포인트',
        body: '올해와 이번 달 흐름을 붙여, 말해야 할 때와 기다려야 할 때를 시기 언어로 설명합니다.',
      },
    ],
  },
  family: {
    ctaTitle: '부모 · 자녀는 말의 무게와 거리 조절을 함께 볼 때 달라집니다',
    ctaBody:
      '자녀에게 남는 말의 무게, 서로 지치기 쉬운 패턴, 응원으로 들리는 표현과 부담으로 남는 표현을 프리미엄에서 더 깊게 읽습니다.',
    preview: [
      {
        title: '갈등이 반복되는 이유',
        body: '서로 상처받는 말투와 반응 순서를 짚어, 왜 비슷한 장면이 반복되는지 설명합니다.',
      },
      {
        title: '가까워지는 방식',
        body: '상대가 위로를 느끼는 말과 거리 두기를 원하는 순간을 읽어 관계의 온도를 조절하게 돕습니다.',
      },
      {
        title: '올해 두 분의 대화 타이밍',
        body: '올해와 이번 달 흐름을 겹쳐 어떤 때에 말하고, 어떤 때에 기다리는 편이 좋은지 읽습니다.',
      },
    ],
  },
  friend: {
    ctaTitle: '형제 · 친구는 편안함 속 숨은 경쟁과 배려의 균형을 볼 때 선명해집니다',
    ctaBody:
      '오래된 친분 안에서 왜 어느 순간 서운함이 생기는지, 서로 기대하는 역할과 거리감의 차이를 프리미엄에서 더 세밀하게 읽습니다.',
    preview: [
      {
        title: '편안함이 깨지는 순간',
        body: '가벼운 말이 오해가 되는 지점과 서로 당연하게 기대하는 역할을 짚습니다.',
      },
      {
        title: '오래 가는 우정의 조건',
        body: '누가 먼저 연락을 열면 좋은지, 어느 정도 거리를 둘 때 관계가 더 오래 안정되는지 읽습니다.',
      },
      {
        title: '함께 움직이기 좋은 시기',
        body: '여행, 금전, 부탁 같은 현실 이슈를 언제 꺼내면 덜 무거운지 시기와 함께 설명합니다.',
      },
    ],
  },
  partner: {
    ctaTitle: '동업 · 파트너는 역할 분담과 재물 감각까지 봐야 판단이 섭니다',
    ctaBody:
      '누가 앞에서 끌고 가고 누가 뒤에서 정리하는지, 돈과 책임을 대하는 감각이 얼마나 맞는지 프리미엄에서 더 구체적으로 읽습니다.',
    preview: [
      {
        title: '역할이 엇갈리는 지점',
        body: '의사결정 속도와 책임감의 결이 어떻게 다른지 짚어 실무 충돌 포인트를 설명합니다.',
      },
      {
        title: '재물 감각의 차이',
        body: '확장과 보수, 투자와 관리 중 누가 어느 쪽에 가까운지 읽어 함께 돈을 다루는 방식을 제안합니다.',
      },
      {
        title: '함께 움직여도 좋은 시기',
        body: '계약, 확장, 정리 중 무엇을 먼저 보는 편이 좋은지 현재 흐름과 연결해 안내합니다.',
      },
    ],
  },
} as const;

export const TAROT_TO_SAJU_BRIDGE = [
  '타로는 지금의 감정과 장면을 읽고, 사주는 그 장면이 왜 반복되는지를 설명합니다.',
  '카드 한 장이 마음에 남았다면, 사주에서는 같은 질문을 대운과 오행의 구조까지 이어서 볼 수 있습니다.',
  '관계, 재물, 진로처럼 오래 붙드는 질문일수록 타로 뒤에 사주를 붙였을 때 해석의 깊이가 크게 달라집니다.',
] as const;

export const TAROT_MIND_ENTRY_POINTS = [
  {
    title: '답보다 마음이 먼저 급할 때',
    body: '상대 마음, 연락, 선택처럼 당장 결론을 알고 싶은 질문은 먼저 감정을 가라앉히는 카드부터 봅니다.',
  },
  {
    title: '같은 생각이 계속 돌아올 때',
    body: '머리로는 알지만 마음이 멈추지 않는 질문은 카드가 지금 붙들고 있는 장면을 보여줍니다.',
  },
  {
    title: '사주까지 보기엔 아직 가벼울 때',
    body: '긴 풀이를 보기 전, 오늘 마음의 방향만 먼저 확인하고 싶을 때 타로가 입구가 됩니다.',
  },
] as const;

export const TAROT_SAJU_BRIDGE_DETAILS = [
  {
    title: '타로는 오늘의 장면',
    body: '지금 마음이 어디에 걸려 있는지, 어떤 말이나 선택이 크게 느껴지는지를 먼저 보여줍니다.',
  },
  {
    title: '사주는 반복되는 이유',
    body: '같은 관계나 선택이 왜 자주 돌아오는지, 내 명식의 기질과 운의 흐름에서 더 길게 읽습니다.',
  },
  {
    title: '상담은 다음 행동',
    body: '카드와 사주를 함께 놓고, 지금 말할지 기다릴지, 밀지 멈출지 같은 현실 행동으로 정리합니다.',
  },
] as const;

export const CHECKOUT_PLAN_GUIDE: Record<
  PlanSlug,
  {
    title: string;
    price: string;
    nextRange: string;
    reassurance: string;
    opens: readonly string[];
    notices: readonly string[];
  }
> = {
  basic: {
    title: '라이트 대화 멤버십',
    price: '월 4,900원',
    nextRange: '첫 결제 후 30일 이용',
    reassurance: '가볍게 시작해도 질문을 이어가는 흐름은 충분히 경험하실 수 있습니다.',
    opens: ['긴 사주풀이 미리보기 월 2회', '기본 해석과 대화 상담', '광고 없는 차분한 이용'],
    notices: ['첫 결제 후 30일 이용권으로 반영', '마이페이지에서 상태 확인 가능', '열람 전 환불 기준 함께 안내'],
  },
  premium: {
    title: '프리미엄 대화 멤버십',
    price: '월 9,900원',
    nextRange: '첫 결제 후 30일 이용',
    reassurance: '가족 사주, 궁합, 대화까지 가장 넓게 이어 쓰실 수 있는 메인 구독 플랜입니다.',
    opens: ['궁합 분석과 가족 사주 5명', '긴 사주풀이 미리보기 월 10회', '대화 상담 월 120턴과 공정사용정책'],
    notices: ['첫 결제 후 30일 이용권으로 반영', '언제든 플랜 화면에서 상태 확인 가능', '이용 내역과 환불 기준을 한 번 더 고지'],
  },
  lifetime: {
    title: '보관형 사주 리포트',
    price: '49,000원',
    nextRange: '한 번 결제 · 평생 소장',
    reassurance: '월 구독 없이 완성본 하나를 오래 보관하고 싶은 분께 맞는 소장형 선택입니다.',
    opens: ['7개 섹션 완성형 풀이', 'PDF 다운로드', '업데이트 반영본 재열람'],
    notices: ['자동 갱신 없음', '결제 즉시 전체 리포트 열람', '평생 보관용 저장본 제공'],
  },
} as const;

export const COMPLETE_PLAN_GUIDE: Record<
  PlanSlug,
  {
    welcome: string;
    giftTitle: string;
    giftBody: string;
    nextSteps: readonly string[];
    primaryHref: string;
    primaryLabel: string;
  }
> = {
  basic: {
    welcome: '가볍게 시작하셨지만, 핵심 해석을 읽기엔 충분한 첫걸음입니다.',
    giftTitle: '이번 달 긴 사주풀이 미리보기 2회',
    giftBody: '기본 해석을 보다가 더 깊이 보고 싶은 결과가 나오면 바로 긴 사주풀이 미리보기로 이어가실 수 있습니다.',
    nextSteps: ['사주 기본 해석부터 저장하기', '마음에 남는 질문을 대화로 이어보기', '첫 긴 사주풀이 미리보기 1회 써보기'],
    primaryHref: '/saju/new',
    primaryLabel: '내 첫 해석 시작하기',
  },
  premium: {
    welcome: '프리미엄 멤버로 모시게 되어 기쁩니다. 가장 넓은 해석 흐름이 지금부터 열립니다.',
    giftTitle: '첫 긴 사주풀이 미리보기',
    giftBody: '궁합, 가족 사주, 대화까지 함께 쓰실 수 있는 메인 플랜의 핵심 혜택이 바로 열렸습니다.',
    nextSteps: ['긴 사주풀이 미리보기 1건 바로 열기', '가족 사주 한 분 저장하기', '궁합 결과를 프리미엄 버전으로 읽어보기'],
    primaryHref: '/saju/new',
    primaryLabel: '지금 긴 풀이 미리보기 열기',
  },
  lifetime: {
    welcome: '한 번의 결제로 완성형 리포트를 오래 간직하실 수 있게 되었습니다.',
    giftTitle: '평생 소장 리포트',
    giftBody: '격국, 용신, 대운, 세운까지 담긴 7개 섹션 완성본과 PDF 저장본이 바로 준비됩니다.',
    nextSteps: ['내 명식으로 완성형 풀이 열기', 'PDF 저장본 확인하기', '업데이트 반영본 다시 보기'],
    primaryHref: '/saju/new',
    primaryLabel: '완성형 리포트 열기',
  },
} as const;

export const TAROT_QUESTION_OPTIONS: readonly MoonlightTarotQuestionOption[] = [
  {
    emoji: '✨',
    label: '오늘 하루 어떤 메시지가 있을까',
    intent: '마음 정리',
    description: '딱히 큰 사건은 없지만 오늘 조심할 말, 붙잡을 기회, 마음의 온도를 알고 싶을 때 봅니다.',
    when: '아침이나 외출 전',
  },
  {
    emoji: '💗',
    label: '지금 고민 중인 관계에 대하여',
    intent: '상대와 관계',
    description: '그 사람 마음, 연락해도 되는지, 관계가 왜 어색해졌는지처럼 마음이 계속 걸릴 때 봅니다.',
    when: '연락 전이나 대화 후',
  },
  {
    emoji: '✅',
    label: '지금 결정해야 할 선택에 대하여',
    intent: '결정과 타이밍',
    description: '지금 바로 진행해도 되는지, 한 번 더 확인해야 하는지 선택의 수위를 정하고 싶을 때 봅니다.',
    when: '계약·이직·고백 전',
  },
  {
    emoji: '🧭',
    label: '앞으로의 방향에 대하여',
    intent: '흐름과 방향',
    description: '앞으로 무엇을 줄이고 무엇을 키워야 할지, 지금 삶의 방향이 맞는지 확인하고 싶을 때 봅니다.',
    when: '월초나 전환기',
  },
] as const;

export const TAROT_CARD_KEYWORDS = [
  ['The Fool', '새로운 발걸음, 두려워 마세요'],
  ['The Moon', '보이는 것 뒤에 숨은 것을 살피세요'],
  ['The Sun', '환한 시기가 옵니다'],
  ['The Hermit', '홀로 있는 시간이 답을 줍니다'],
  ['The Lovers', '마음이 향하는 쪽이 옳은 쪽입니다'],
  ['Death', '끝이 아니라 새로운 시작입니다'],
] as const;

export const TAROT_CARD_READING_COPY = {
  'The Fool': {
    arcana: '0',
    title: '바보 · The Fool',
    subtitle: '시작과 순수',
    guidance:
      '새롭게 움직여보라는 메시지입니다. 아직 확신이 다 서지 않았더라도 작은 발걸음을 떼는 쪽에서 기회가 생깁니다.',
    sajuBlend:
      '선생님의 사주 흐름과 만나면, 이 카드는 오래 망설인 일을 너무 무겁게만 보지 말고 한 번쯤 가볍게 시작해보라고 권합니다.',
    action:
      '완벽히 준비될 때까지 기다리기보다 오늘 할 수 있는 가장 작은 시작 하나를 정해보세요.',
  },
  'The Moon': {
    arcana: 'XVIII',
    title: '달 · The Moon',
    subtitle: '직관과 무의식',
    guidance:
      '보이는 것 뒤에 숨은 것을 살피라는 메시지입니다. 지금 관계에서 드러난 장면보다 드러나지 않은 진심이 더 중요합니다.',
    sajuBlend:
      '선생님의 사주와 만나면 이 카드는 앞서 나가려는 기운을 잠시 식혀주며, 감정을 먼저 드러내기보다 상대의 속내와 타이밍을 읽으라고 권합니다.',
    action:
      '말 한마디 전에 “혹시 이분은 어떤 마음일까”를 세 번쯤 헤아려보세요.',
  },
  'The Sun': {
    arcana: 'XIX',
    title: '태양 · The Sun',
    subtitle: '성취와 기쁨',
    guidance:
      '기운이 환하게 열리는 카드입니다. 움츠렸던 이야기나 관계를 조금 더 밝게 드러낼수록 흐름이 쉬워집니다.',
    sajuBlend:
      '사주 흐름과 만나면, 이 카드는 선생님의 장점과 진심을 감추지 말고 드러내는 편이 재물과 관계 모두에 더 도움이 된다고 읽습니다.',
    action:
      '감사나 칭찬, 반가운 마음을 한 번 더 표현해보세요. 좋은 흐름이 더 크게 열립니다.',
  },
  'The Hermit': {
    arcana: 'IX',
    title: '은둔자 · The Hermit',
    subtitle: '성찰과 내면의 등불',
    guidance:
      '서두르기보다 조용히 돌아보라는 카드입니다. 답은 바깥의 소란보다 내 안의 정리에서 먼저 찾아옵니다.',
    sajuBlend:
      '사주와 겹쳐 보면 지금은 많은 사람의 의견보다 선생님 스스로의 감각과 경험을 신뢰할 때라고 읽을 수 있습니다.',
    action:
      '혼자 차분히 생각할 시간을 조금 확보해보세요. 오늘의 답은 고요한 틈에서 더 선명해집니다.',
  },
  'The Lovers': {
    arcana: 'VI',
    title: '연인 · The Lovers',
    subtitle: '선택과 조화',
    guidance:
      '마음이 향하는 쪽을 분명히 하라는 메시지입니다. 사람과 일 모두에서 무엇을 가까이 둘지 선택이 필요합니다.',
    sajuBlend:
      '선생님의 사주 흐름과 만나면, 이 카드는 관계를 억지로 끌고 가기보다 진심이 통하는 방향을 또렷이 정할수록 더 편해진다고 읽습니다.',
    action:
      '좋아하는 방향과 지키고 싶은 관계를 오늘 안에 한 줄로 정리해보세요.',
  },
  Death: {
    arcana: 'XIII',
    title: '변화 · Death',
    subtitle: '정리와 재출발',
    guidance:
      '끝이 아니라 새로운 시작을 알리는 카드입니다. 오래 붙들고 있던 방식 하나를 정리하면 다음 장면이 열립니다.',
    sajuBlend:
      '사주 흐름과 함께 보면, 이 카드는 선생님이 이미 충분히 해오신 일을 내려놓고 더 가벼운 방식으로 옮겨갈 시점이 왔음을 말해줍니다.',
    action:
      '미련보다 정리가 필요한 한 가지를 골라 오늘 조용히 마무리해보세요.',
  },
} as const;

export const TEN_GODS_GUIDE: readonly MoonlightTenGodCard[] = [
  {
    name: '정인',
    hanja: '배움',
    meaning: '학문 · 후원 · 어머니',
    seniorCopy: '나를 돌봐주는 손길, 그런 사람이 있으십니까',
  },
  {
    name: '편인',
    hanja: '직감',
    meaning: '직관 · 전문기술',
    seniorCopy: '남다른 감각, 특별한 눈',
  },
  {
    name: '비견',
    hanja: '나',
    meaning: '동료 · 형제 · 자존',
    seniorCopy: '나와 같은 결의 사람들',
  },
  {
    name: '겁재',
    hanja: '경쟁',
    meaning: '경쟁 · 재물 분산',
    seniorCopy: '가까운 듯 가까이 있으면 닳는 인연',
  },
  {
    name: '식신',
    hanja: '표현',
    meaning: '표현 · 여유 · 자녀',
    seniorCopy: '내가 키워내는 것, 자녀 혹은 결실',
  },
  {
    name: '상관',
    hanja: '재능',
    meaning: '재능 · 반항',
    seniorCopy: '재주가 넘쳐 틀을 벗어나는 자유로움',
  },
  {
    name: '정재',
    hanja: '저축',
    meaning: '고정 재물 · 배우자',
    seniorCopy: '꾸준히 쌓아올리신 것들',
  },
  {
    name: '편재',
    hanja: '흐름',
    meaning: '유동 재물 · 활동',
    seniorCopy: '큰 물결처럼 들고 나는 재물',
  },
  {
    name: '정관',
    hanja: '자리',
    meaning: '명예 · 직장',
    seniorCopy: '나를 세워주는 자리, 그 이름',
  },
  {
    name: '편관',
    hanja: '단련',
    meaning: '권력 · 경쟁',
    seniorCopy: '나를 단련시키는 힘',
  },
] as const;

export const MEMBERSHIP_REASSURANCE = [
  '해지는 언제든 가능하며, 남은 이용 기간은 끝까지 편히 보실 수 있습니다.',
  '열람 전 상태와 이용 기준을 먼저 보여드리고, 환불 기준도 같은 화면에서 확인하실 수 있습니다.',
  '현재 멤버십 결제는 30일 이용권으로 먼저 안전하게 반영하고, 자동 갱신 결제키 연동은 별도 단계로 다룹니다.',
] as const;

export const CHECKOUT_METHODS = [
  '카드 결제 또는 계좌이체 선택',
  '결제 승인 후 멤버십 자동 반영',
  '실패 시 권한 미반영 후 결제 화면 복귀',
] as const;

export const SETTINGS_BLUEPRINT = [
  {
    title: '글자 크기',
    options: '보통 · 크게 · 아주 크게',
    reason: '시력 개인차에 맞춰 읽기 부담을 줄입니다.',
  },
  {
    title: '말투',
    options: '정중 · 친근 · 표준',
    reason: '기본은 정중체로 두고 개인 취향을 반영합니다.',
  },
  {
    title: '한자 표기',
    options: '한자 병기 · 한글만',
    reason: '세대별 선호와 이해도를 함께 맞춥니다.',
  },
  {
    title: '알림 시간',
    options: '아침 · 점심 · 저녁',
    reason: '매일 같은 시간에 들어오게 만드는 루틴을 돕습니다.',
  },
  {
    title: '알림 스타일',
    options: '조용히 · 보통 · 소리',
    reason: '방해 수준을 스스로 선택할 수 있게 합니다.',
  },
  {
    title: '생체 인증',
    options: '지문 · 얼굴 · 4자리 비밀번호',
    reason: '복잡한 비밀번호 없이도 안전하게 다시 들어올 수 있습니다.',
  },
  {
    title: '데이터 관리',
    options: '내 데이터 내보내기 · 계정 삭제',
    reason: '개인정보와 보관 기록을 투명하게 관리할 수 있습니다.',
  },
] as const;

export const FAMILY_PLAN_LIMITS = [
  '무료·라이트: 본인만 저장',
  '프리미엄: 본인 + 가족 5명',
  '보관형 리포트: 본인 + 가족 10명',
] as const;

export const STAR_SIGN_BLUEPRINT = {
  featuredSlug: 'pisces',
  intro: '저 먼 별빛이 오늘 당신에게 전하는 한 마디',
  cross: '서양의 별빛과 동양의 명식을 나란히 놓고, 오늘 마음에 더 가까운 결을 함께 읽어드립니다.',
} as const;

export const STAR_SIGN_META = {
  aries: { symbol: '♈', seniorCopy: '한 번 결심하면 끝까지 가시는 분' },
  taurus: { symbol: '♉', seniorCopy: '뿌리 깊은 나무 같은 분' },
  gemini: { symbol: '♊', seniorCopy: '늘 새로운 것을 찾는 젊은 마음' },
  cancer: { symbol: '♋', seniorCopy: '가족을 품에 안는 따뜻한 분' },
  leo: { symbol: '♌', seniorCopy: '존재 자체로 빛나시는 분' },
  virgo: { symbol: '♍', seniorCopy: '세심함이 큰 재산인 분' },
  libra: { symbol: '♎', seniorCopy: '양쪽을 헤아리는 지혜를 지닌 분' },
  scorpio: { symbol: '♏', seniorCopy: '속마음이 깊은 분' },
  sagittarius: { symbol: '♐', seniorCopy: '멀리 보는 안목을 지닌 분' },
  capricorn: { symbol: '♑', seniorCopy: '묵묵히 쌓아오신 분' },
  aquarius: { symbol: '♒', seniorCopy: '남다른 시선을 가지신 분' },
  pisces: { symbol: '♓', seniorCopy: '마음으로 먼저 아시는 분' },
} as const;

export const ZODIAC_BLUEPRINT = {
  highlightedSlug: 'snake',
  yearlyLabel: '2026년 말의 해',
} as const;

export const ZODIAC_META = {
  rat: { symbol: '🐭', yearlyMessage: '쌓아둔 씨앗이 싹을 틔우는 해' },
  ox: { symbol: '🐮', yearlyMessage: '묵묵히 한 걸음, 큰 열매를 맺는 해' },
  tiger: { symbol: '🐯', yearlyMessage: '오래 미뤄둔 일을 정리하실 해' },
  rabbit: { symbol: '🐰', yearlyMessage: '안팎의 균형을 다잡는 해' },
  dragon: { symbol: '🐲', yearlyMessage: '날아오를 준비를 마무리하는 해' },
  snake: { symbol: '🐍', yearlyMessage: '깊이 사고하고 때를 기다리는 해' },
  horse: { symbol: '🐴', yearlyMessage: '본인의 해, 크게 움직이기보다 중심을 잡는 해' },
  goat: { symbol: '🐑', yearlyMessage: '주변과의 관계가 더 따뜻해지는 해' },
  monkey: { symbol: '🐵', yearlyMessage: '새로운 만남과 배움이 활발한 해' },
  rooster: { symbol: '🐔', yearlyMessage: '오래 준비한 일이 빛을 보는 해' },
  dog: { symbol: '🐶', yearlyMessage: '가까운 이들과 더욱 돈독해지는 해' },
  pig: { symbol: '🐷', yearlyMessage: '풍요가 조용히 쌓이는 해' },
} as const;

export function toneClasses(tone: MoonlightTone) {
  switch (tone) {
    case 'goldSoft':
      return {
        text: 'text-[var(--app-pink-strong)]',
        border: 'border-[var(--app-pink)]/28',
        bg: 'bg-[var(--app-pink)]/10',
      };
    case 'jade':
      return {
        text: 'text-[var(--app-jade)]',
        border: 'border-[var(--app-jade)]/28',
        bg: 'bg-[var(--app-jade)]/10',
      };
    case 'plum':
      return {
        text: 'text-[var(--app-plum)]',
        border: 'border-[var(--app-plum)]/28',
        bg: 'bg-[var(--app-plum)]/10',
      };
    case 'sky':
      return {
        text: 'text-[var(--app-sky)]',
        border: 'border-[var(--app-sky)]/28',
        bg: 'bg-[var(--app-sky)]/10',
      };
    case 'coral':
      return {
        text: 'text-[var(--app-coral)]',
        border: 'border-[var(--app-coral)]/28',
        bg: 'bg-[var(--app-coral)]/10',
      };
    case 'gold':
    default:
      return {
        text: 'text-[var(--app-gold-text)]',
        border: 'border-[var(--app-gold)]/28',
        bg: 'bg-[var(--app-gold)]/10',
      };
  }
}
