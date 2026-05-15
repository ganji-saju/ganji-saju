// 2026-05-15 — 12 별자리 콘텐츠 라이브러리.
// 성격·연애·직업·럭키·신화 등 정적 콘텐츠 + 12×12 호환 매트릭스.
// /star-sign/[slug] 페이지의 콘텐츠 두께를 확장하기 위해 추가.

export type StarSignSlug =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export type SignElement = 'fire' | 'earth' | 'air' | 'water';
export type SignQuality = 'cardinal' | 'fixed' | 'mutable';

export interface SignContent {
  slug: StarSignSlug;
  element: SignElement;
  quality: SignQuality;
  rulingPlanet: string;
  rulingPlanetKo: string;
  birthstone: string;
  motto: string;
  /** 강점 3-5개. */
  strengths: string[];
  /** 약점 3-5개. */
  weaknesses: string[];
  /** 매력 한 줄. */
  loveCharm: string;
  /** 연애 약점 한 줄. */
  loveCaveat: string;
  /** 잘 맞는 별자리 3개 slug. */
  idealMatches: StarSignSlug[];
  /** 조심해야 하는 별자리 1-2개 slug. */
  loveBeware: StarSignSlug[];
  /** 직업 강점 1-2 문장. */
  careerStrength: string;
  /** 추천 직업 3-5개. */
  careerSuggestions: string[];
  /** 직업 약점 한 줄. */
  careerCaveat: string;
  /** 럭키 컬러 (CSS color). */
  luckyColor: { name: string; hex: string };
  /** 럭키 숫자 1-9. */
  luckyNumbers: number[];
  /** 럭키 요일 (월~일). */
  luckyDay: string;
  /** 행운 방위 (동남서북). */
  luckyDirection: string;
  /** 강한 신체 부위 (전통 점성술). */
  bodyStrong: string;
  /** 약한 신체 부위. */
  bodyWeak: string;
  /** 한 줄 신화. */
  mythology: string;
}

const FIRE_HEX = '#ff6b6b';
const EARTH_HEX = '#8b9d6f';
const AIR_HEX = '#7aa9d3';
const WATER_HEX = '#5e84b3';

export const STAR_SIGN_CONTENT: Record<StarSignSlug, SignContent> = {
  aries: {
    slug: 'aries',
    element: 'fire',
    quality: 'cardinal',
    rulingPlanet: 'Mars',
    rulingPlanetKo: '화성',
    birthstone: '다이아몬드',
    motto: '먼저 움직이는 사람',
    strengths: ['추진력', '용기', '솔직함', '리더십', '즉행력'],
    weaknesses: ['성급함', '욱하는 성격', '인내심 부족', '말의 톤 조절'],
    loveCharm: '망설임 없이 다가가는 직진과 진심으로 마음을 두드린다',
    loveCaveat: '익숙해지면 표현이 줄어들어 식어 보일 수 있다',
    idealMatches: ['leo', 'sagittarius', 'gemini'],
    loveBeware: ['cancer', 'capricorn'],
    careerStrength: '0→1 단계에서 빛난다. 새로운 프로젝트 시작과 위기 돌파에 강하다.',
    careerSuggestions: ['창업·스타트업', '영업·세일즈', '운동선수·코치', '응급·구조', '군경'],
    careerCaveat: '루틴 업무가 길어지면 집중이 빠르게 떨어진다',
    luckyColor: { name: '진홍', hex: '#dc2626' },
    luckyNumbers: [1, 9],
    luckyDay: '화요일',
    luckyDirection: '동쪽',
    bodyStrong: '머리·시신경',
    bodyWeak: '편두통·치아·열병',
    mythology: '황금 양털 — 형제를 구한 헌신과 신화 속 영웅의 시작.',
  },
  taurus: {
    slug: 'taurus',
    element: 'earth',
    quality: 'fixed',
    rulingPlanet: 'Venus',
    rulingPlanetKo: '금성',
    birthstone: '에메랄드',
    motto: '꾸준함이 곧 운',
    strengths: ['끈기', '신뢰', '안정감', '미적 감각', '실용성'],
    weaknesses: ['고집', '변화 거부', '소유욕', '의심'],
    loveCharm: '천천히 다가가지만 한번 마음을 주면 깊고 오래 간다',
    loveCaveat: '질투와 소유욕이 강해 상대를 답답하게 할 수 있다',
    idealMatches: ['virgo', 'capricorn', 'cancer'],
    loveBeware: ['aquarius', 'leo'],
    careerStrength: '장기 프로젝트 완성도가 높다. 손에 잡히는 결과물에 강하다.',
    careerSuggestions: ['금융·재무', '요리·F&B', '디자이너', '농업·원예', '부동산'],
    careerCaveat: '갑작스러운 방향 전환에 적응이 느리다',
    luckyColor: { name: '에메랄드', hex: '#10b981' },
    luckyNumbers: [2, 6],
    luckyDay: '금요일',
    luckyDirection: '남동쪽',
    bodyStrong: '목·인후',
    bodyWeak: '갑상선·후두염',
    mythology: '제우스가 변신한 황소 — 묵묵하고 강한 사랑의 화신.',
  },
  gemini: {
    slug: 'gemini',
    element: 'air',
    quality: 'mutable',
    rulingPlanet: 'Mercury',
    rulingPlanetKo: '수성',
    birthstone: '진주',
    motto: '말로 세상을 잇는다',
    strengths: ['빠른 두뇌', '말솜씨', '호기심', '적응력', '유머'],
    weaknesses: ['변덕', '집중력 부족', '말과 행동의 격차', '얕은 몰입'],
    loveCharm: '재치 있는 대화로 지루할 틈을 주지 않는다',
    loveCaveat: '관심이 분산되면 진심이 의심받기 쉽다',
    idealMatches: ['libra', 'aquarius', 'aries'],
    loveBeware: ['virgo', 'pisces'],
    careerStrength: '정보 수집·해석·전달에 강하다. 여러 일을 동시에 굴린다.',
    careerSuggestions: ['기자·작가', '마케팅', 'PM·기획', '교사', '통역·번역'],
    careerCaveat: '깊은 한 가지 전문성 쌓기에는 인내가 필요하다',
    luckyColor: { name: '레몬옐로', hex: '#fde047' },
    luckyNumbers: [3, 5, 7],
    luckyDay: '수요일',
    luckyDirection: '서쪽',
    bodyStrong: '폐·어깨',
    bodyWeak: '신경·수면 부족',
    mythology: '쌍둥이 형제 카스토르와 폴룩스 — 분리될 수 없는 형제의 정.',
  },
  cancer: {
    slug: 'cancer',
    element: 'water',
    quality: 'cardinal',
    rulingPlanet: 'Moon',
    rulingPlanetKo: '달',
    birthstone: '루비',
    motto: '품는 사람의 따뜻함',
    strengths: ['공감력', '직관', '가족애', '보살핌', '기억력'],
    weaknesses: ['감정 기복', '서운함', '간섭', '집착'],
    loveCharm: '깊은 공감과 세심함으로 상대를 안심시킨다',
    loveCaveat: '감정 표현이 간접적이라 오해가 쌓이기 쉽다',
    idealMatches: ['scorpio', 'pisces', 'taurus'],
    loveBeware: ['aries', 'libra'],
    careerStrength: '사람을 돌보고 분위기를 만드는 일에 강하다.',
    careerSuggestions: ['간호·복지', '심리상담', '요식업', '교육·보육', 'HR'],
    careerCaveat: '공정한 비판이 필요한 자리에서는 감정이 흔들린다',
    luckyColor: { name: '실버화이트', hex: '#e5e7eb' },
    luckyNumbers: [2, 7],
    luckyDay: '월요일',
    luckyDirection: '북서쪽',
    bodyStrong: '가슴·소화기',
    bodyWeak: '위장·유선',
    mythology: '헤라가 보낸 게 — 헤라클레스의 발을 무는 충직한 수호자.',
  },
  leo: {
    slug: 'leo',
    element: 'fire',
    quality: 'fixed',
    rulingPlanet: 'Sun',
    rulingPlanetKo: '태양',
    birthstone: '페리도트',
    motto: '빛나야 살아 있는',
    strengths: ['카리스마', '관대함', '자신감', '창의력', '드라마틱한 표현'],
    weaknesses: ['자존심', '인정 욕구', '독단', '드라마 과잉'],
    loveCharm: '아낌없는 표현과 큰 사랑으로 상대를 주인공처럼 만든다',
    loveCaveat: '주목받지 못하면 식고, 작은 무시에도 자존심이 상한다',
    idealMatches: ['aries', 'sagittarius', 'gemini'],
    loveBeware: ['taurus', 'scorpio'],
    careerStrength: '주목받는 자리에서 강하다. 스토리텔링과 무대 위 표현에 능하다.',
    careerSuggestions: ['연예·연기', '브랜드 크리에이티브', '경영자', '이벤트 디렉터', '강연자'],
    careerCaveat: '익명·반복 업무에서 동력을 잃는다',
    luckyColor: { name: '골드', hex: '#facc15' },
    luckyNumbers: [1, 5, 9],
    luckyDay: '일요일',
    luckyDirection: '동쪽',
    bodyStrong: '심장·등',
    bodyWeak: '심혈관·등통증',
    mythology: '네메아의 사자 — 태양의 위엄을 상징하는 헤라클레스의 적수.',
  },
  virgo: {
    slug: 'virgo',
    element: 'earth',
    quality: 'mutable',
    rulingPlanet: 'Mercury',
    rulingPlanetKo: '수성',
    birthstone: '사파이어',
    motto: '디테일이 완성을 만든다',
    strengths: ['분석력', '꼼꼼함', '책임감', '실용성', '봉사정신'],
    weaknesses: ['완벽주의', '잔걱정', '비판', '자기검열'],
    loveCharm: '말없이 챙기는 디테일에서 마음이 드러난다',
    loveCaveat: '비판하는 듯한 말투가 상대에게 거리감을 만든다',
    idealMatches: ['taurus', 'capricorn', 'cancer'],
    loveBeware: ['gemini', 'sagittarius'],
    careerStrength: '품질·정확도·문서화에 강하다. 시스템화에 탁월하다.',
    careerSuggestions: ['회계·감사', '의료·약사', '편집·교정', 'QA', '데이터 분석'],
    careerCaveat: '큰 그림보다 작은 실수에 멈춰 서기 쉽다',
    luckyColor: { name: '네이비', hex: '#1e3a8a' },
    luckyNumbers: [5, 6],
    luckyDay: '수요일',
    luckyDirection: '남서쪽',
    bodyStrong: '소화·복부',
    bodyWeak: '장·신경성 위염',
    mythology: '대지의 여신 데메테르 — 추수와 결실의 정확함.',
  },
  libra: {
    slug: 'libra',
    element: 'air',
    quality: 'cardinal',
    rulingPlanet: 'Venus',
    rulingPlanetKo: '금성',
    birthstone: '오팔',
    motto: '균형이 곧 정의',
    strengths: ['공정함', '균형감', '미적 감각', '외교', '협상'],
    weaknesses: ['결정 장애', '갈등 회피', '의존', '눈치 보기'],
    loveCharm: '예의 바른 매너와 우아한 분위기로 호감을 산다',
    loveCaveat: '갈등을 피하려다 솔직함을 놓친다',
    idealMatches: ['gemini', 'aquarius', 'leo'],
    loveBeware: ['cancer', 'capricorn'],
    careerStrength: '협상·조정·중재의 자리에서 빛난다. 미감이 핵심인 일에 강하다.',
    careerSuggestions: ['법조·외교', '디자인', 'PR·홍보', '인테리어', '협상가'],
    careerCaveat: '단독 결단이 필요한 자리에서는 망설인다',
    luckyColor: { name: '핑크', hex: '#f472b6' },
    luckyNumbers: [4, 6],
    luckyDay: '금요일',
    luckyDirection: '서쪽',
    bodyStrong: '허리·신장',
    bodyWeak: '신장·요통',
    mythology: '정의의 여신 디케 — 천칭으로 사람의 마음을 잰다.',
  },
  scorpio: {
    slug: 'scorpio',
    element: 'water',
    quality: 'fixed',
    rulingPlanet: 'Pluto',
    rulingPlanetKo: '명왕성',
    birthstone: '토파즈',
    motto: '깊이로 승부한다',
    strengths: ['집중력', '몰입', '통찰', '의리', '재생력'],
    weaknesses: ['집착', '복수심', '의심', '비밀주의'],
    loveCharm: '강한 몰입과 비밀스러운 매력이 상대를 끌어당긴다',
    loveCaveat: '한 번 상처받으면 깊이 닫히고 오래 풀리지 않는다',
    idealMatches: ['cancer', 'pisces', 'capricorn'],
    loveBeware: ['leo', 'aquarius'],
    careerStrength: '깊은 분석·심리·조사에 강하다. 위기 시 침착하다.',
    careerSuggestions: ['수사·법의학', '심리상담', '연구·박사', '의료(외과)', '전략 컨설팅'],
    careerCaveat: '권력 구도를 너무 의식해 적을 만들 수 있다',
    luckyColor: { name: '딥와인', hex: '#7c2d12' },
    luckyNumbers: [4, 8],
    luckyDay: '화요일',
    luckyDirection: '북쪽',
    bodyStrong: '생식기·재생',
    bodyWeak: '비뇨·생식기 염증',
    mythology: '오리온을 죽인 전갈 — 운명을 바꾸는 한 방의 독.',
  },
  sagittarius: {
    slug: 'sagittarius',
    element: 'fire',
    quality: 'mutable',
    rulingPlanet: 'Jupiter',
    rulingPlanetKo: '목성',
    birthstone: '터키석',
    motto: '경계 너머로 쏘는 화살',
    strengths: ['낙천성', '확장성', '솔직함', '모험심', '철학'],
    weaknesses: ['직설', '경솔함', '약속 헐거움', '책임 회피'],
    loveCharm: '자유롭고 유쾌한 에너지로 함께 있는 것이 즐겁다',
    loveCaveat: '구속받는다 느끼면 빠르게 식는다',
    idealMatches: ['aries', 'leo', 'libra'],
    loveBeware: ['virgo', 'pisces'],
    careerStrength: '국제·교육·출판 등 영역 확장에 강하다. 비전 제시에 탁월하다.',
    careerSuggestions: ['교수·교사', '국제업무·외국어', '여행·항공', '출판·미디어', '철학·종교'],
    careerCaveat: '세부 실행은 다른 사람에게 맡겨야 효율이 난다',
    luckyColor: { name: '퍼플', hex: '#7c3aed' },
    luckyNumbers: [3, 7, 9],
    luckyDay: '목요일',
    luckyDirection: '남쪽',
    bodyStrong: '간·허벅지',
    bodyWeak: '간·좌골신경통',
    mythology: '켄타우로스 케이론 — 활을 쏘는 현자, 영웅을 길러낸 스승.',
  },
  capricorn: {
    slug: 'capricorn',
    element: 'earth',
    quality: 'cardinal',
    rulingPlanet: 'Saturn',
    rulingPlanetKo: '토성',
    birthstone: '가넷',
    motto: '시간을 내 편으로 만든다',
    strengths: ['책임감', '인내', '실행력', '현실 감각', '야망'],
    weaknesses: ['지나친 비관', '딱딱함', '감정 억제', '워커홀릭'],
    loveCharm: '말보다 행동으로 책임지는 자세가 안정감을 준다',
    loveCaveat: '감정 표현이 적어 차갑게 비칠 수 있다',
    idealMatches: ['taurus', 'virgo', 'scorpio'],
    loveBeware: ['aries', 'libra'],
    careerStrength: '장기 목표·조직 관리·전략에 강하다. 시간이 갈수록 빛난다.',
    careerSuggestions: ['임원·CEO', '공무·정책', '건축·엔지니어링', '회계·재무', '프로젝트 매니저'],
    careerCaveat: '동료 정서 케어가 미흡하면 권위로만 비친다',
    luckyColor: { name: '차콜', hex: '#374151' },
    luckyNumbers: [4, 8],
    luckyDay: '토요일',
    luckyDirection: '북동쪽',
    bodyStrong: '뼈·관절',
    bodyWeak: '관절·치아·피부 건조',
    mythology: '바다염소 판 — 위기 속에서도 끝까지 책임을 진 신.',
  },
  aquarius: {
    slug: 'aquarius',
    element: 'air',
    quality: 'fixed',
    rulingPlanet: 'Uranus',
    rulingPlanetKo: '천왕성',
    birthstone: '자수정',
    motto: '내일을 먼저 살아본다',
    strengths: ['독창성', '인도주의', '객관성', '비전', '개방성'],
    weaknesses: ['고집', '냉정함', '거리감', '예측 불가'],
    loveCharm: '특별한 시각과 친구 같은 편안함으로 끌어당긴다',
    loveCaveat: '감정보다 논리가 앞서 차갑게 느껴질 수 있다',
    idealMatches: ['gemini', 'libra', 'sagittarius'],
    loveBeware: ['taurus', 'scorpio'],
    careerStrength: 'IT·사회혁신·미래기술에 강하다. 무에서 유를 만드는 비전 작업.',
    careerSuggestions: ['IT·개발', '연구·과학', '사회운동·NGO', '미래 전략가', '예술 실험'],
    careerCaveat: '조직 안의 미세한 인간 관계는 피로하게 느낀다',
    luckyColor: { name: '스카이블루', hex: '#0ea5e9' },
    luckyNumbers: [4, 7, 11],
    luckyDay: '토요일',
    luckyDirection: '북쪽',
    bodyStrong: '종아리·순환',
    bodyWeak: '하지순환·정맥류',
    mythology: '제우스의 술잔 따르는 가니메데 — 영원한 청춘의 자유.',
  },
  pisces: {
    slug: 'pisces',
    element: 'water',
    quality: 'mutable',
    rulingPlanet: 'Neptune',
    rulingPlanetKo: '해왕성',
    birthstone: '아쿠아마린',
    motto: '느낌이 곧 진실',
    strengths: ['공감력', '예술성', '직관', '연민', '상상력'],
    weaknesses: ['경계 약함', '회피', '의존', '현실 감각 부족'],
    loveCharm: '온화하고 헌신적인 사랑으로 상대를 보호한다',
    loveCaveat: '경계가 모호해 상처를 자주 입는다',
    idealMatches: ['cancer', 'scorpio', 'taurus'],
    loveBeware: ['gemini', 'sagittarius'],
    careerStrength: '창작·치유·영성 분야에 강하다. 마음의 결을 다루는 일에 빛난다.',
    careerSuggestions: ['예술가·음악가', '심리치료', '간호·요양', '영성·종교', '자선·NGO'],
    careerCaveat: '냉정한 판단이 필요한 자리에서는 감정에 쓸린다',
    luckyColor: { name: '시폼그린', hex: '#22d3ee' },
    luckyNumbers: [3, 7, 12],
    luckyDay: '목요일',
    luckyDirection: '서남쪽',
    bodyStrong: '발·림프',
    bodyWeak: '발·면역·우울감',
    mythology: '아프로디테 모자가 변한 두 물고기 — 위기 속의 모성과 사랑.',
  },
};

export const ELEMENT_HEX: Record<SignElement, string> = {
  fire: FIRE_HEX,
  earth: EARTH_HEX,
  air: AIR_HEX,
  water: WATER_HEX,
};

export const ELEMENT_LABEL: Record<SignElement, string> = {
  fire: '불',
  earth: '땅',
  air: '공기',
  water: '물',
};

export const QUALITY_LABEL: Record<SignQuality, string> = {
  cardinal: '시작 (주도)',
  fixed: '고정 (지속)',
  mutable: '변통 (적응)',
};

/**
 * 12×12 호환 매트릭스 — element + quality 조합으로 점수 산출.
 * - 동일 element: +25 (불-불, 물-물)
 * - 조화 element (불-공기, 땅-물): +18
 * - 중성 element (불-땅, 공기-물): +5
 * - 충돌 element (불-물, 땅-공기): -8
 * - 동일 사인: 90 (기본 자기조화)
 * - opposite (180°): 75 (자석)
 * - trine (120°): 88
 * - square (90°): 62
 * - sextile (60°): 80
 * - inconjunct (150°): 55
 */
const ELEMENT_AFFINITY: Record<SignElement, Record<SignElement, number>> = {
  fire: { fire: 88, earth: 65, air: 90, water: 55 },
  earth: { fire: 65, earth: 86, air: 60, water: 88 },
  air: { fire: 90, earth: 60, air: 86, water: 62 },
  water: { fire: 55, earth: 88, air: 62, water: 90 },
};

const SIGN_ORDER: StarSignSlug[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

/** A 와 B 의 호환 점수 (50~95). 대칭 (a→b = b→a). */
export function getCompatibilityScore(a: StarSignSlug, b: StarSignSlug): number {
  if (a === b) return 90;
  const ai = SIGN_ORDER.indexOf(a);
  const bi = SIGN_ORDER.indexOf(b);
  const diff = Math.abs(ai - bi) % 12;
  const minDiff = Math.min(diff, 12 - diff);

  const baseElement = ELEMENT_AFFINITY[STAR_SIGN_CONTENT[a].element][STAR_SIGN_CONTENT[b].element];
  let aspectAdjust = 0;
  switch (minDiff) {
    case 0:
      aspectAdjust = 0; // 위에서 처리
      break;
    case 6: // opposite — 자석
      aspectAdjust = -3;
      break;
    case 4: // trine — best
      aspectAdjust = 4;
      break;
    case 3: // square — 갈등
      aspectAdjust = -14;
      break;
    case 2: // sextile — 부드러움
      aspectAdjust = 2;
      break;
    case 5: // inconjunct — 어색
      aspectAdjust = -10;
      break;
    case 1: // semi-sextile — 약간
      aspectAdjust = -6;
      break;
    default:
      aspectAdjust = 0;
  }
  // bisymmetric 보정 + clamp.
  const raw = baseElement + aspectAdjust;
  return Math.max(50, Math.min(95, raw));
}

export function getCompatibilityTone(score: number): 'best' | 'good' | 'mid' | 'avoid' {
  if (score >= 85) return 'best';
  if (score >= 75) return 'good';
  if (score >= 60) return 'mid';
  return 'avoid';
}

/** 12개 sign 모두에 대한 호환 점수. */
export function getAllCompatibilities(slug: StarSignSlug): Array<{
  slug: StarSignSlug;
  score: number;
  tone: 'best' | 'good' | 'mid' | 'avoid';
}> {
  return SIGN_ORDER.map((other) => {
    const score = getCompatibilityScore(slug, other);
    return { slug: other, score, tone: getCompatibilityTone(score) };
  }).sort((a, b) => b.score - a.score);
}
