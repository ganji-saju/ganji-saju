// 2026-05-15 — 별자리 두 개 궁합 상세 분석.
// /star-sign/compat/[a]/[b] 페이지에서 사용.
// PR #127 의 getCompatibilityScore() 점수 + element/quality 결합 + 6 영역 분석.

import {
  ELEMENT_LABEL,
  STAR_SIGN_CONTENT,
  getCompatibilityScore,
  getCompatibilityTone,
  type SignElement,
  type StarSignSlug,
} from './sign-content';

export interface AreaScore {
  /** 영역명. */
  area: '연애' | '우정' | '직장' | '결혼' | '소통' | '여행';
  score: number; // 50~95
  hint: string;
}

export interface CompatibilityReport {
  a: StarSignSlug;
  b: StarSignSlug;
  /** 종합 점수 (sign-content.ts 와 동일). */
  overallScore: number;
  tone: 'best' | 'good' | 'mid' | 'avoid';
  /** 한 줄 헤드라인. */
  headline: string;
  /** 어떤 점이 잘 맞는가 — 2-4 bullet. */
  strengths: string[];
  /** 어떤 점이 부딪치는가 — 2-3 bullet. */
  tensions: string[];
  /** 6 영역별 점수. */
  areas: AreaScore[];
  /** 데이트 추천 3가지. */
  dateIdeas: string[];
  /** 갈등 극복 팁. */
  conflictTips: string[];
  /** element 관계 라벨 (같은 원소, 트라인, 상극 등). */
  elementRelation: string;
  /** quality 관계 라벨. */
  qualityRelation: string;
}

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

function angleDiff(a: StarSignSlug, b: StarSignSlug): number {
  const ai = SIGN_ORDER.indexOf(a);
  const bi = SIGN_ORDER.indexOf(b);
  const diff = Math.abs(ai - bi);
  return Math.min(diff, 12 - diff);
}

function elementRelationLabel(ae: SignElement, be: SignElement): string {
  if (ae === be) return `같은 ${ELEMENT_LABEL[ae]} 원소`;
  const harmonic =
    (ae === 'fire' && be === 'air') ||
    (ae === 'air' && be === 'fire') ||
    (ae === 'earth' && be === 'water') ||
    (ae === 'water' && be === 'earth');
  if (harmonic) return '조화 원소 (호흡이 잘 맞음)';
  const clash =
    (ae === 'fire' && be === 'water') ||
    (ae === 'water' && be === 'fire') ||
    (ae === 'earth' && be === 'air') ||
    (ae === 'air' && be === 'earth');
  if (clash) return '대조 원소 (서로를 깨우는 결)';
  return '중성 원소';
}

const QUALITY_PAIR_LABEL: Record<string, string> = {
  'cardinal-cardinal': '두 시작형 — 둘 다 끌고 가려 함',
  'cardinal-fixed': '시작 × 고정 — 새로운 일에 기둥이 되는 조합',
  'cardinal-mutable': '시작 × 변통 — 끌고 가는 쪽과 받아주는 쪽',
  'fixed-fixed': '두 고정형 — 깊이는 강하나 변화 어려움',
  'fixed-mutable': '고정 × 변통 — 단단한 축 + 부드러운 적응',
  'mutable-mutable': '두 변통형 — 자유롭지만 결정이 어려움',
};

function qualityRelationLabel(aq: string, bq: string): string {
  const key = `${aq}-${bq}`;
  return (
    QUALITY_PAIR_LABEL[key] ??
    QUALITY_PAIR_LABEL[`${bq}-${aq}`] ??
    '두 모달리티의 만남'
  );
}

function buildHeadline(score: number, ae: SignElement, be: SignElement): string {
  if (score >= 88) {
    if (ae === be) return '같은 결의 환상의 짝꿍 — 자연스럽게 통합니다';
    return '서로를 빛나게 하는 완벽한 호흡';
  }
  if (score >= 78) {
    return '잘 맞춰가면 깊은 신뢰가 쌓이는 관계';
  }
  if (score >= 65) {
    return '서로 다른 결을 이해하면 큰 성장이 있는 관계';
  }
  if (score >= 55) {
    return '큰 차이가 있지만 그만큼 배울 점이 많은 관계';
  }
  return '특히 신중함이 필요한 조합 — 노력이 큰 차이를 만듭니다';
}

/** 6 영역별 점수 산출 — overall 베이스 + 영역별 보정. */
function buildAreas(a: StarSignSlug, b: StarSignSlug, overall: number): AreaScore[] {
  const ac = STAR_SIGN_CONTENT[a];
  const bc = STAR_SIGN_CONTENT[b];
  const angle = angleDiff(a, b);

  // 연애: opposite (6) 자석 효과 +5, square (3) -5.
  const loveBoost = angle === 6 ? 5 : angle === 3 ? -5 : 0;
  // 우정: 같은 원소 +6, trine +4.
  const friendBoost = ac.element === bc.element ? 6 : angle === 4 ? 4 : 0;
  // 직장: quality 같으면 +3 (호흡), trine +5.
  const workBoost = ac.quality === bc.quality ? 3 : angle === 4 ? 5 : 0;
  // 결혼: 같은 원소 +4, opposite +3, square -7.
  const marryBoost =
    ac.element === bc.element ? 4 : angle === 6 ? 3 : angle === 3 ? -7 : 0;
  // 소통: 공기-공기, 공기-불 보너스 +6.
  const commBoost =
    (ac.element === 'air' && bc.element === 'air') ||
    (ac.element === 'air' && bc.element === 'fire') ||
    (bc.element === 'air' && ac.element === 'fire')
      ? 6
      : 0;
  // 여행: 둘 다 mutable +6, 불-불 +4.
  const travelBoost =
    ac.quality === 'mutable' && bc.quality === 'mutable'
      ? 6
      : ac.element === 'fire' && bc.element === 'fire'
        ? 4
        : 0;

  const clamp = (v: number) => Math.max(50, Math.min(95, Math.round(v)));

  return [
    {
      area: '연애',
      score: clamp(overall + loveBoost),
      hint:
        angle === 6
          ? '대각선 자석 — 서로 끌리는 힘이 강해요'
          : angle === 3
            ? '긴장이 있지만 그만큼 자극되는 관계'
            : '편안한 연애 호흡을 만들 수 있어요',
    },
    {
      area: '우정',
      score: clamp(overall + friendBoost),
      hint:
        ac.element === bc.element
          ? '같은 원소라 이해가 빨라요'
          : '서로 다른 시각이 우정을 풍부하게',
    },
    {
      area: '직장',
      score: clamp(overall + workBoost),
      hint:
        ac.quality === bc.quality
          ? '같은 모달리티라 일하는 리듬이 비슷해요'
          : '서로 다른 역할이 팀의 균형을 잡습니다',
    },
    {
      area: '결혼',
      score: clamp(overall + marryBoost),
      hint:
        angle === 3
          ? '장기 관계는 작은 갈등 해소가 키예요'
          : '서로의 다름을 인정하면 안정감이 깊어집니다',
    },
    {
      area: '소통',
      score: clamp(overall + commBoost),
      hint:
        commBoost > 0
          ? '대화의 결이 자연스럽게 흐릅니다'
          : '말보다 행동으로 마음을 전하면 좋아요',
    },
    {
      area: '여행',
      score: clamp(overall + travelBoost),
      hint:
        travelBoost > 0
          ? '여행 케미가 좋은 조합 — 즉흥도 잘 맞아요'
          : '여행은 계획을 미리 맞춰두는 편이 좋아요',
    },
  ];
}

const ELEMENT_DATE_IDEAS: Record<SignElement, string[]> = {
  fire: [
    '액티브한 야외 활동 — 등산·자전거·새로운 도시 탐험',
    '함께 무대 보기 — 콘서트·페스티벌·스포츠 경기',
    '같이 도전 — 요리 클래스·새 운동·요리 챌린지',
  ],
  earth: [
    '편안한 미식 — 좋아하는 카페·맛집·디저트 투어',
    '자연 속 휴식 — 정원·식물원·온천·캠핑',
    '같이 만들기 — 도자기·향초·베이킹 원데이 클래스',
  ],
  air: [
    '깊은 대화가 가능한 곳 — 북카페·전시·강연',
    '새로운 사람들 — 모임·파티·동호회 함께 참여',
    '여행 계획 짜기 — 짧은 당일치기 드라이브',
  ],
  water: [
    '잔잔한 분위기 — 물가 산책·노을 카페·바닷가',
    '함께 영화 — 감성 영화·뮤지컬·미술관',
    '서로의 마음 듣기 — 조용한 식당·달밤 산책',
  ],
};

function buildDateIdeas(a: StarSignSlug, b: StarSignSlug): string[] {
  const ac = STAR_SIGN_CONTENT[a];
  const bc = STAR_SIGN_CONTENT[b];
  if (ac.element === bc.element) {
    return ELEMENT_DATE_IDEAS[ac.element];
  }
  // 두 원소가 다를 때 — 각 element 1개씩 + 공통 1개.
  return [
    ELEMENT_DATE_IDEAS[ac.element][0]!,
    ELEMENT_DATE_IDEAS[bc.element][0]!,
    '서로의 취향을 번갈아 — 한 번은 둘 중 한 명이 좋아하는 코스로',
  ];
}

function buildStrengths(a: StarSignSlug, b: StarSignSlug, score: number): string[] {
  const ac = STAR_SIGN_CONTENT[a];
  const bc = STAR_SIGN_CONTENT[b];
  const items: string[] = [];

  if (ac.element === bc.element) {
    items.push(`같은 ${ELEMENT_LABEL[ac.element]} 원소 — 정서적 동질감이 큽니다`);
  } else {
    const harmonic =
      (ac.element === 'fire' && bc.element === 'air') ||
      (ac.element === 'air' && bc.element === 'fire') ||
      (ac.element === 'earth' && bc.element === 'water') ||
      (ac.element === 'water' && bc.element === 'earth');
    if (harmonic) {
      items.push('조화 원소 — 서로의 결이 자연스럽게 보완됩니다');
    }
  }

  const angle = angleDiff(a, b);
  if (angle === 4) items.push('120° 트라인 — 무리하지 않아도 잘 맞는 각도');
  if (angle === 2) items.push('60° 섹스타일 — 부드럽고 우호적인 각도');
  if (angle === 6) items.push('180° 오포지션 — 서로를 거울처럼 비추는 자석');

  if (ac.quality === bc.quality) {
    items.push('같은 모달리티 — 일과 결정의 리듬이 통합니다');
  }

  if (score >= 80) {
    items.push('서로의 강점을 자연스럽게 인정하는 케미');
  }
  if (items.length === 0) {
    items.push('서로 다른 결을 발견하며 천천히 신뢰를 쌓을 수 있는 관계');
  }
  return items.slice(0, 4);
}

function buildTensions(a: StarSignSlug, b: StarSignSlug, score: number): string[] {
  const ac = STAR_SIGN_CONTENT[a];
  const bc = STAR_SIGN_CONTENT[b];
  const items: string[] = [];

  const angle = angleDiff(a, b);
  if (angle === 3) items.push('90° 스퀘어 — 같은 일에 대해 접근 방식이 부딪칠 수 있어요');
  if (angle === 5) items.push('150° 인콘정크션 — 서로의 결이 어색하게 엇갈리기 쉬워요');

  const clash =
    (ac.element === 'fire' && bc.element === 'water') ||
    (ac.element === 'water' && bc.element === 'fire') ||
    (ac.element === 'earth' && bc.element === 'air') ||
    (ac.element === 'air' && bc.element === 'earth');
  if (clash) {
    items.push(`${ELEMENT_LABEL[ac.element]} × ${ELEMENT_LABEL[bc.element]} 원소 — 우선순위와 속도가 달라요`);
  }

  if (ac.quality === 'fixed' && bc.quality === 'fixed') {
    items.push('둘 다 고정형 — 한 번 정한 입장을 굽히기 어려운 편');
  }

  if (score < 65) {
    items.push('말 한 마디의 톤에 신경 쓰면 오해를 크게 줄일 수 있어요');
  }
  if (items.length === 0) {
    items.push('대부분 잘 맞지만 익숙해질수록 표현이 줄어들 수 있어요');
  }
  return items.slice(0, 3);
}

function buildConflictTips(a: StarSignSlug, b: StarSignSlug): string[] {
  const ac = STAR_SIGN_CONTENT[a];
  const bc = STAR_SIGN_CONTENT[b];
  const tips: string[] = [];

  if (ac.quality === 'fixed' && bc.quality === 'fixed') {
    tips.push('갈등 시 둘 다 한 발씩 물러나는 룰을 정해두세요');
  }
  if (ac.element === 'fire' || bc.element === 'fire') {
    tips.push('말의 톤을 한 단계 부드럽게 — 직선적 표현은 한 박자 늦추기');
  }
  if (ac.element === 'water' || bc.element === 'water') {
    tips.push('감정 표현을 미루지 말고 그날 그날 짧게 풀어두세요');
  }
  if (tips.length < 3) {
    tips.push('정기적인 짧은 대화 시간 — 일주일에 한 번 30분이면 충분합니다');
  }
  return tips.slice(0, 3);
}

export function analyzeCompatibility(a: StarSignSlug, b: StarSignSlug): CompatibilityReport {
  const overall = getCompatibilityScore(a, b);
  const tone = getCompatibilityTone(overall);
  const ac = STAR_SIGN_CONTENT[a];
  const bc = STAR_SIGN_CONTENT[b];
  const areas = buildAreas(a, b, overall);

  return {
    a,
    b,
    overallScore: overall,
    tone,
    headline: buildHeadline(overall, ac.element, bc.element),
    strengths: buildStrengths(a, b, overall),
    tensions: buildTensions(a, b, overall),
    areas,
    dateIdeas: buildDateIdeas(a, b),
    conflictTips: buildConflictTips(a, b),
    elementRelation: elementRelationLabel(ac.element, bc.element),
    qualityRelation: qualityRelationLabel(ac.quality, bc.quality),
  };
}
